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

    // Only set TTL on the first request in the window.
    // Subsequent increments preserve the existing TTL so the window
    // expires naturally instead of resetting on every request.
    if (count === 0) {
      await c.env.KV.put(kvKey, "1", {
        expirationTtl: config.windowSeconds,
      });
    } else {
      await c.env.KV.put(kvKey, String(count + 1));
    }

    await next();
  };
}
