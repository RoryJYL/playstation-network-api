import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { PSNProfileGet } from "./endpoints/psn-profile";
import { TrophyDetailsGet } from "./endpoints/trophy-details";
import { setCachedProfile } from "./services/cache";
import { sendNpssoExpiryAlert } from "./services/email";
import { fetchPSNProfile } from "./services/psn";

const app = new Hono<{ Bindings: Env }>();

// 根据 ALLOWED_DOMAINS 配置访问控制
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowedDomainsRaw: string = c.env.ALLOWED_DOMAINS || "";
      if (allowedDomainsRaw.trim() === "*") {
        return "*";
      }

      const allowedDomains = allowedDomainsRaw
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      if (allowedDomains.length === 0) {
        return "";
      }

      const isAllowed = allowedDomains.some((domain) =>
        origin.includes(domain),
      );

      return isAllowed ? origin : "";
    },
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

const openapi = fromHono(app, {
  docs_url: "/",
});

openapi.get("/api/profile-summary", PSNProfileGet);
openapi.get("/api/trophy-details/:npCommunicationId", TrophyDetailsGet);

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const profile = await fetchPSNProfile(env.PSN_CACHE, env.PSN_NPSSO);
          await setCachedProfile(env.PSN_CACHE, profile);
        } catch (error) {
          if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
            try {
              await sendNpssoExpiryAlert(env.RESEND_API_KEY, env.ALERT_EMAIL);
            } catch {
              // Email sending failed, log it
              console.error("Failed to send alert email");
            }
          }
          throw error;
        }
      })(),
    );
  },
};
