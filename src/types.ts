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
    }),
  ),
});

export type PSNProfileData = z.infer<typeof PSNProfile>;
