import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const PSNProfile = z.object({
  onlineId: z.string(),
  avatarUrl: z.string(),
  totalTrophies: z.number(),
  bronzeTrophies: z.number(),
  silverTrophies: z.number(),
  goldTrophies: z.number(),
  platinumTrophies: z.number(),
  platinumGames: z.array(
    z.object({
      title: z.string(),
      iconUrl: z.string(),
      earnedDate: z.string(),
      earnedTrophies: z.object({
        bronze: z.number(),
        silver: z.number(),
        gold: z.number(),
        platinum: z.number(),
      }),
      platform: z.string(),
      progress: z.number(),
      npCommunicationId: z.string(),
      trophyDetails: z
        .object({
          trophies: z.unknown(), // Full trophy list from getUserTrophiesEarnedForTitle
          gameInfo: z.object({
            title: z.string(),
            iconUrl: z.string(),
            earnedDate: z.string(),
          }),
          updatedAt: z.string(),
        })
        .optional(), // Optional: may not be cached yet
    }),
  ),
});

export type PSNProfileData = z.infer<typeof PSNProfile>;
