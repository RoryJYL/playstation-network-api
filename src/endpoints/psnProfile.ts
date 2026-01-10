import { OpenAPIRoute, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { getCachedProfile, setCachedProfile } from "../services/cache";
import { sendNpssoExpiryAlert } from "../services/email";
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
    const cached = await getCachedProfile(c.env.PSN_CACHE);
    const now = Date.now();
    const age = (now - cached.timestamp) / 1000;
    const isExpired = age > cacheTtl;

    if (!forceRefresh && cached && !isExpired) {
      return c.json(cached.data);
    }

    try {
      const profile = await fetchPSNProfile(c.env.PSN_CACHE, npsso);
      await setCachedProfile(c.env.PSN_CACHE, profile);
      return c.json(profile);
    } catch (error) {
      console.error("Failed to fetch PSN profile", error);
      // Send alert email if configured
      if (c.env.RESEND_API_KEY && c.env.ALERT_EMAIL) {
        try {
          await sendNpssoExpiryAlert(c.env.RESEND_API_KEY, c.env.ALERT_EMAIL);
        } catch {
          console.error("Failed to send alert email");
        }
      }
      // Return cached data if available
      return c.json(cached.data);
    }
  }
}
