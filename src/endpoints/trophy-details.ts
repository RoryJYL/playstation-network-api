import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getTrophyDetails } from "../services/trophy-cache";
import type { AppContext } from "../types";

export class TrophyDetailsGet extends OpenAPIRoute {
  schema = {
    tags: ["PSN Trophy"],
    summary: "Get detailed trophy information for a specific game",
    request: {
      params: z.object({
        npCommunicationId: z
          .string()
          .describe("The npCommunicationId of the game"),
      }),
    },
    responses: {
      "200": {
        description: "Trophy details retrieved successfully",
        content: {
          "application/json": {
            schema: z.object({
              trophies: z.any().describe("Full trophy data from PSN API"),
              gameInfo: z.object({
                title: z.string(),
                iconUrl: z.string(),
                earnedDate: z.string(),
              }),
              updatedAt: z.string(),
            }),
          },
        },
      },
      "404": {
        description: "Trophy details not found",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const npCommunicationId = c.req.param("npCommunicationId");

    if (!npCommunicationId) {
      return c.json(
        { error: "npCommunicationId parameter is required" },
        400,
      );
    }

    const details = await getTrophyDetails(c.env.PSN_CACHE, npCommunicationId);

    if (!details) {
      return c.json(
        {
          error: `Trophy details not found for ${npCommunicationId}`,
        },
        404,
      );
    }

    return c.json(details);
  }
}
