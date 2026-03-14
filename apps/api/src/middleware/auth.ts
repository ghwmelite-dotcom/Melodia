import type { Context, Next } from "hono";
import type { Env, Variables } from "../types.js";
import { AppError } from "./error-handler.js";
import { verifyJwt } from "../lib/jwt.js";

export function authGuard() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHORIZED", "Missing or invalid authorization header", 401);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyJwt(token, c.env.JWT_SECRET);
      c.set("userId", payload.sub);
      await next();
    } catch {
      throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
    }
  };
}

export function optionalAuthGuard() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
        c.set("userId", payload.sub);
      } catch {
        // Invalid token — continue as unauthenticated
      }
    }
    await next();
  };
}
