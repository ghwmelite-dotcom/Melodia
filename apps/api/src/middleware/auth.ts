import type { Context, Next } from "hono";
import type { Env, Variables } from "../types.js";
import { AppError } from "./error-handler.js";

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
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(c.env.JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const [headerB64, payloadB64, signatureB64] = token.split(".");
      if (!headerB64 || !payloadB64 || !signatureB64) {
        throw new Error("Invalid token format");
      }

      const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
      const signature = base64UrlDecode(signatureB64);
      const valid = await crypto.subtle.verify("HMAC", key, signature, data);
      if (!valid) throw new Error("Invalid signature");

      const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("Token expired");
      }

      c.set("userId", payload.sub);
      await next();
    } catch {
      throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
    }
  };
}

function base64UrlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
