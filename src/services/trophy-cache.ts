/**
 * Trophy cache management using Cloudflare KV
 *
 * Storage structure:
 * - "trophy_details:{npCommunicationId}" -> Trophy details for a single game
 * - "platinum_games_index" -> Index of all platinum games
 */

import type { TrophyTitle } from "psn-api";

export interface TrophyDetails {
  trophies: unknown; // Full response from getUserTrophiesEarnedForTitle
  gameInfo: {
    title: string;
    iconUrl: string;
    earnedDate: string;
  };
  updatedAt: string;
}

export interface PlatinumGameIndexEntry {
  npCommunicationId: string;
  title: string;
  earnedDate: string;
  npServiceName: TrophyTitle["npServiceName"];
}

export interface PlatinumGamesIndex {
  games: PlatinumGameIndexEntry[];
  lastUpdated: string;
}

const TROPHY_DETAILS_PREFIX = "trophy_details:";
const PLATINUM_INDEX_KEY = "platinum_games_index";

/**
 * Get trophy details for a specific game
 */
export async function getTrophyDetails(
  kv: KVNamespace,
  npCommunicationId: string,
): Promise<TrophyDetails | null> {
  const key = `${TROPHY_DETAILS_PREFIX}${npCommunicationId}`;
  return await kv.get<TrophyDetails>(key, "json");
}

/**
 * Save trophy details for a specific game
 */
export async function saveTrophyDetails(
  kv: KVNamespace,
  npCommunicationId: string,
  details: TrophyDetails,
): Promise<void> {
  const key = `${TROPHY_DETAILS_PREFIX}${npCommunicationId}`;
  await kv.put(key, JSON.stringify(details));
}

/**
 * Get the platinum games index
 */
export async function getPlatinumGamesIndex(
  kv: KVNamespace,
): Promise<PlatinumGamesIndex> {
  const index = await kv.get<PlatinumGamesIndex>(PLATINUM_INDEX_KEY, "json");

  if (!index) {
    // Return empty index if not exists
    return {
      games: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  return index;
}

/**
 * Update the platinum games index
 */
export async function updatePlatinumGamesIndex(
  kv: KVNamespace,
  games: PlatinumGameIndexEntry[],
): Promise<void> {
  const index: PlatinumGamesIndex = {
    games,
    lastUpdated: new Date().toISOString(),
  };

  await kv.put(PLATINUM_INDEX_KEY, JSON.stringify(index));
}
