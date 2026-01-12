import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { PSNProfileGet } from "./endpoints/psnProfile";
import { setCachedProfile } from "./services/cache";
import { sendNpssoExpiryAlert } from "./services/email";
import { fetchPSNProfile } from "./services/psn";

const app = new Hono<{ Bindings: Env }>();

// CORS 中间件 - 根据 ALLOWED_DOMAINS 配置访问控制
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowedDomainsRaw: string = c.env.ALLOWED_DOMAINS || "";

      // 如果配置为 "*",允许所有来源
      if (allowedDomainsRaw.trim() === "*") {
        return "*";
      }

      // 解析域名白名单
      const allowedDomains = allowedDomainsRaw
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      // 如果未配置白名单,拒绝所有请求
      if (allowedDomains.length === 0) {
        return "";
      }

      // 检查来源是否在白名单中
      const isAllowed = allowedDomains.some((domain) =>
        origin.includes(domain),
      );

      // 只有在白名单中才返回 origin,否则拒绝
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
