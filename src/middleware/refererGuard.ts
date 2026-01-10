import type { Context, Next } from "hono";

/**
 * Referer/Origin 白名单中间件
 * 只允许来自特定域名的请求访问 API
 *
 * 配置方式:
 * - ALLOWED_DOMAINS="*" - 允许所有来源(禁用访问控制)
 * - ALLOWED_DOMAINS="domain1.com,domain2.com" - 只允许特定域名
 * - 未配置 - 拒绝所有请求(安全默认值)
 */
export async function refererGuard(c: Context<{ Bindings: Env }>, next: Next) {
  const allowedDomainsRaw = c.env.ALLOWED_DOMAINS || "";

  // 如果配置为 "*",允许所有来源
  if (allowedDomainsRaw.trim() === "*") {
    return await next();
  }

  // 解析域名白名单
  const allowedDomains = allowedDomainsRaw
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  // 如果未配置白名单,拒绝所有请求(安全默认值)
  if (allowedDomains.length === 0) {
    return c.json(
      {
        error: "Access control not configured.",
      },
      500,
    );
  }

  const referer = c.req.header("referer") || "";
  const origin = c.req.header("origin") || "";

  // 检查请求来源是否在白名单中
  const isAllowed = allowedDomains.some(
    (domain) => referer.includes(domain) || origin.includes(domain),
  );

  if (!isAllowed) {
    return c.json(
      {
        error: "Forbidden: Invalid referer or origin",
        hint: "This API can only be accessed from authorized domains",
      },
      403,
    );
  }

  await next();
}
