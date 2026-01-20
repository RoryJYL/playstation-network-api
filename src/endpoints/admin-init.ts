import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { fetchPSNProfile } from "../services/psn";
import type { AppContext } from "../types";

/**
 * Admin endpoint to manually trigger trophy cache initialization
 *
 * Usage: GET /api/admin/init-cache?secret=your_secret
 *
 * WARNING: This endpoint should be protected and removed after initial setup
 */
export class AdminInitGet extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "Initialize trophy cache (admin only)",
    request: {
      query: z.object({
        secret: z.string().describe("Admin secret"),
      }),
    },
    responses: {
      "200": {
        description: "Initialization started",
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
              status: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const secret = c.req.query("secret");
    const expectedSecret = c.env.ADMIN_SECRET;

    // Simple secret check
    if (!expectedSecret || secret !== expectedSecret) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      // This will detect all platinum games as "new" on first run
      // and populate the cache with trophy details
      const profile = await fetchPSNProfile(c.env.PSN_CACHE, c.env.PSN_NPSSO);

      return c.json({
        message: "Trophy cache initialization completed",
        status: "success",
        platinumGamesCount: profile.platinumGames.length,
      });
    } catch (error) {
      console.error("Initialization failed:", error);
      return c.json(
        {
          error: "Initialization failed",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  }
}
