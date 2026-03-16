import type { Context, Next } from "hono";
import type { Env, Variables } from "../types.js";
import { AppError } from "./error-handler.js";

type RateLimitConfig = {
  key: (c: Context<{ Bindings: Env; Variables: Variables }>) => string;
  limit: number;
  windowSeconds: number;
};

export function rateLimit(config: RateLimitConfig) {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const key = config.key(c);
    const kvKey = `rate:${key}`;
    const current = await c.env.KV.get(kvKey);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.limit) {
      throw new AppError("RATE_LIMITED", "Too many requests, try again later", 429);
    }

    // IMPORTANT: Always include expirationTtl on every put.
    // KV put() without TTL removes any existing TTL, making the key permanent.
    // This means we reset the window on each request, but that's acceptable —
    // the alternative (permanent lockout) is far worse.
    await c.env.KV.put(kvKey, String(count + 1), {
      expirationTtl: config.windowSeconds,
    });

    await next();
  };
}
