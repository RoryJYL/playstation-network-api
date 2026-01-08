import { OpenAPIRoute, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { getCachedProfile, setCachedProfile } from "../services/cache";
import { fetchPSNProfile } from "../services/psn";
import { PSNProfile } from "../types";

export class PSNProfileGet extends OpenAPIRoute {
  schema = {
    tags: ["PSN"],
    summary: "Get PSN profile with trophy statistics",
    request: {
      query: z.object({
        refresh: Str({
          description: "Set to 'true' to force cache refresh",
          required: false,
        }),
      }),
    },
    responses: {
      "200": {
        description: "PSN profile data",
        content: {
          "application/json": {
            schema: PSNProfile,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const npsso = c.env.PSN_NPSSO;
    if (!npsso) {
      return c.json({ error: "PSN_NPSSO not configured" }, 500);
    }

    const forceRefresh = c.req.query("refresh") === "true";
    const cacheTtl = Number(c.env.CACHE_TTL_SECONDS) || 86400;

    if (!forceRefresh) {
      const cached = await getCachedProfile(c.env.PSN_CACHE, cacheTtl);
      if (cached) {
        return c.json(cached);
      }
    }

    const profile = await fetchPSNProfile(c.env.PSN_CACHE, npsso);
    await setCachedProfile(c.env.PSN_CACHE, profile);

    return c.json(profile);
  }
}
