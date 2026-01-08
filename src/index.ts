import { fromHono } from "chanfana";
import { Hono } from "hono";
import { PSNProfileGet } from "./endpoints/psnProfile";
import { setCachedProfile } from "./services/cache";
import { fetchPSNProfile } from "./services/psn";

const app = new Hono<{ Bindings: Env }>();

const openapi = fromHono(app, {
  docs_url: "/",
});

openapi.get("/api/psn", PSNProfileGet);

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const profile = await fetchPSNProfile(env.PSN_CACHE, env.PSN_NPSSO);
        await setCachedProfile(env.PSN_CACHE, profile);
      })(),
    );
  },
};
