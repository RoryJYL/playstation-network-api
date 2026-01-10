import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getUserTitles,
  getUserTrophyProfileSummary,
} from "psn-api";
import type { PSNProfileData } from "../types";

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

export async function fetchPSNProfile(
  kv: KVNamespace,
  npsso: string,
): Promise<PSNProfileData> {
  try {
    const accessToken = await getValidAccessToken(kv, npsso);

    const [{ profile: userProfile }, trophySummary, titlesResponse] =
      await Promise.all([
        getProfileFromUserName({ accessToken }, "me"),
        getUserTrophyProfileSummary({ accessToken }, "me"),
        getUserTitles({ accessToken }, "me", { limit: 800 }),
      ]);

    const platinumGames = titlesResponse.trophyTitles
      .filter((title) => title.earnedTrophies.platinum > 0 && !title.hiddenFlag)
      .map((title) => ({
        title: title.trophyTitleName,
        iconUrl: title.trophyTitleIconUrl,
        earnedDate: title.lastUpdatedDateTime,
        earnedTrophies: title.earnedTrophies,
      }));

    return {
      onlineId: userProfile.onlineId || "Unknown",
      avatarUrl: userProfile.avatarUrls[0].avatarUrl || "",
      totalTrophies:
        trophySummary.earnedTrophies.bronze +
        trophySummary.earnedTrophies.silver +
        trophySummary.earnedTrophies.gold +
        trophySummary.earnedTrophies.platinum,
      bronzeTrophies: trophySummary.earnedTrophies.bronze,
      silverTrophies: trophySummary.earnedTrophies.silver,
      goldTrophies: trophySummary.earnedTrophies.gold,
      platinumTrophies: trophySummary.earnedTrophies.platinum,
      platinumGames,
    };
  } catch (error) {
    console.error("Failed to fetch PSN profile", error);
    throw error;
  }
}
