import type { PSNProfileData } from "../types";

const CACHE_KEY = "psn:profile:data";

interface CachedData {
  data: PSNProfileData;
  timestamp: number;
}

export async function getCachedProfile(
  kv: KVNamespace,
  ttlSeconds: number,
): Promise<PSNProfileData | null> {
  const cached = await kv.get<CachedData>(CACHE_KEY, "json");

  if (!cached) {
    return null;
  }

  const now = Date.now();
  const age = (now - cached.timestamp) / 1000;

  if (age > ttlSeconds) {
    return null;
  }

  return cached.data;
}

export async function setCachedProfile(
  kv: KVNamespace,
  data: PSNProfileData,
): Promise<void> {
  const cached: CachedData = {
    data,
    timestamp: Date.now(),
  };

  await kv.put(CACHE_KEY, JSON.stringify(cached));
}
