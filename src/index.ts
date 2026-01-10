import { fromHono } from "chanfana";
import { Hono } from "hono";
import { PSNProfileGet } from "./endpoints/psnProfile";
import { refererGuard } from "./middleware/refererGuard";
import { setCachedProfile } from "./services/cache";
import { sendNpssoExpiryAlert } from "./services/email";
import { fetchPSNProfile } from "./services/psn";

const app = new Hono<{ Bindings: Env }>();

// 应用 Referer 白名单中间件到所有路由
app.use("*", refererGuard);

const openapi = fromHono(app, {
  docs_url: "/",
});

openapi.get("/api/profile-summary", PSNProfileGet);

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
          // If both refresh token and npsso failed, send alert
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
