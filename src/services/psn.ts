import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getTitleTrophies,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  getUserTrophyProfileSummary,
} from "psn-api";
import type { PSNProfileData } from "../types";
import { getHeaderOverrides } from "../utils/header-overrides";
import { sleep } from "../utils/rate-limiter";
import {
  getPlatinumGamesIndex,
  getTrophyDetails,
  type PlatinumGameIndexEntry,
  saveTrophyDetails,
  type TrophyDetails,
  updatePlatinumGamesIndex,
} from "./trophy-cache";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const TOKEN_STORAGE_KEY = "psn_auth_tokens";

async function getStoredTokens(kv: KVNamespace): Promise<AuthTokens | null> {
  const stored = await kv.get(TOKEN_STORAGE_KEY, "json");
  return stored as AuthTokens | null;
}

async function saveTokens(kv: KVNamespace, tokens: AuthTokens): Promise<void> {
  await kv.put(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

async function getAuthTokensFromNpsso(npsso: string): Promise<AuthTokens> {
  const authCode = await exchangeNpssoForAccessCode(npsso);
  const tokens = await exchangeAccessCodeForAuthTokens(authCode);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

async function getValidAccessToken(
  kv: KVNamespace,
  npsso: string,
): Promise<string> {
  const stored = await getStoredTokens(kv);

  // Try refresh token first
  if (stored?.refreshToken) {
    try {
      const newTokens = await exchangeRefreshTokenForAuthTokens(
        stored.refreshToken,
      );
      const tokens: AuthTokens = {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };
      await saveTokens(kv, tokens);
      return tokens.accessToken;
    } catch (error) {
      // Refresh failed, fall through to npsso
      console.error("Failed to refresh access token", error);
    }
  }

  // Fallback to npsso
  try {
    const tokens = await getAuthTokensFromNpsso(npsso);
    await saveTokens(kv, tokens);
    return tokens.accessToken;
  } catch (error) {
    console.error("Failed to get valid access token", error);
    throw error;
  }
}

/**
 * Update trophy details for new platinum games (incremental update)
 */
async function updateNewPlatinumGamesTrophies(
  kv: KVNamespace,
  accessToken: string,
  currentGames: PlatinumGameIndexEntry[],
  platinumGames: Array<{
    npCommunicationId: string;
    iconUrl: string;
    title: string;
  }>,
): Promise<void> {
  const headerOverrides = getHeaderOverrides();
  const index = await getPlatinumGamesIndex(kv);
  const existingIds = new Set(index.games.map((g) => g.npCommunicationId));
  const newGames = currentGames.filter(
    (game) => !existingIds.has(game.npCommunicationId),
  );

  if (newGames.length === 0) {
    return; // No new games, skip
  }

  console.log(`发现 ${newGames.length} 个新白金游戏，开始获取详情...`);
  const failedGames: string[] = [];

  for (const game of newGames) {
    try {
      console.log(`正在获取 ${game.title} 的奖杯详情...`);

      // Fetch both trophy metadata and user's earned status
      const [titleTrophies, userTrophies] = await Promise.all([
        getTitleTrophies({ accessToken }, game.npCommunicationId, "all", {
          npServiceName: game.npServiceName,
          headerOverrides,
        }),
        getUserTrophiesEarnedForTitle(
          { accessToken },
          "me",
          game.npCommunicationId,
          "all",
          {
            npServiceName: game.npServiceName,
            headerOverrides,
          },
        ),
      ]);

      // Merge trophy metadata with earned status
      const completeTrophies = titleTrophies.trophies.map((titleTrophy) => {
        const userTrophy = userTrophies.trophies.find(
          (ut) => ut.trophyId === titleTrophy.trophyId,
        );
        return {
          ...titleTrophy, // trophyName, trophyDetail, trophyIconUrl, trophyType
          ...userTrophy, // earned, earnedDateTime, trophyEarnedRate, trophyRare
        };
      });

      const details: TrophyDetails = {
        trophies: completeTrophies,
        gameInfo: {
          title: game.title,
          iconUrl:
            platinumGames.find(
              (g) => g.npCommunicationId === game.npCommunicationId,
            )?.iconUrl || "",
          earnedDate: game.earnedDate,
        },
        updatedAt: new Date().toISOString(),
      };

      await saveTrophyDetails(kv, game.npCommunicationId, details);

      // Rate limiting: 300ms delay between requests
      if (newGames.indexOf(game) < newGames.length - 1) {
        await sleep(300);
      }
    } catch (error) {
      console.error(`获取 ${game.title} 详情失败:`, error);
      failedGames.push(game.npCommunicationId);
    }
  }

  // Update index with all current games (excluding failed ones)
  const successGames = currentGames.filter(
    (game) => !failedGames.includes(game.npCommunicationId),
  );
  await updatePlatinumGamesIndex(kv, successGames);
  console.log(
    `索引已更新，共 ${successGames.length} 个白金游戏，失败 ${failedGames.length} 个`,
  );
}

export async function fetchPSNProfile(
  kv: KVNamespace,
  npsso: string,
): Promise<PSNProfileData> {
  try {
    const accessToken = await getValidAccessToken(kv, npsso);
    const headerOverrides = getHeaderOverrides();

    const [{ profile: userProfile }, trophySummary, titlesResponse] =
      await Promise.all([
        getProfileFromUserName({ accessToken }, "me"),
        getUserTrophyProfileSummary({ accessToken }, "me", { headerOverrides }),
        getUserTitles({ accessToken }, "me", {
          limit: 800,
        }),
      ]);

    const platinumGames = titlesResponse.trophyTitles
      .filter((title) => title.earnedTrophies.platinum > 0 && !title.hiddenFlag)
      .map((title) => ({
        title: title.trophyTitleName,
        iconUrl: title.trophyTitleIconUrl,
        earnedDate: title.lastUpdatedDateTime,
        earnedTrophies: title.earnedTrophies,
        platform: title.trophyTitlePlatform,
        progress: title.progress,
        npCommunicationId: title.npCommunicationId,
        npServiceName: title.npServiceName,
      }));

    // Incremental update: detect and fetch new platinum games' trophy details
    const currentGames: PlatinumGameIndexEntry[] = platinumGames.map(
      (game) => ({
        npCommunicationId: game.npCommunicationId,
        title: game.title,
        earnedDate: game.earnedDate,
        npServiceName: game.npServiceName,
      }),
    );

    await updateNewPlatinumGamesTrophies(
      kv,
      accessToken,
      currentGames,
      platinumGames,
    );

    // Fetch trophy details from KV for all platinum games
    const platinumGamesWithDetails = await Promise.all(
      platinumGames.map(async (game) => {
        const details = await getTrophyDetails(kv, game.npCommunicationId);
        return {
          ...game,
          trophyDetails: details
            ? {
                trophies: details.trophies,
                updatedAt: details.updatedAt,
              }
            : undefined,
        };
      }),
    );

    // avatar url is http, need to convert to https
    const avatarUrl = userProfile.avatarUrls[0].avatarUrl.replace(
      "http://",
      "https://",
    );

    return {
      onlineId: userProfile.onlineId || "Unknown",
      avatarUrl,
      totalTrophies:
        trophySummary.earnedTrophies.bronze +
        trophySummary.earnedTrophies.silver +
        trophySummary.earnedTrophies.gold +
        trophySummary.earnedTrophies.platinum,
      bronzeTrophies: trophySummary.earnedTrophies.bronze,
      silverTrophies: trophySummary.earnedTrophies.silver,
      goldTrophies: trophySummary.earnedTrophies.gold,
      platinumTrophies: trophySummary.earnedTrophies.platinum,
      platinumGames: platinumGamesWithDetails,
    };
  } catch (error) {
    console.error("Failed to fetch PSN profile", error);
    throw error;
  }
}
