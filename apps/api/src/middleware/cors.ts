import { cors } from "hono/cors";

export function corsMiddleware(corsOrigin: string) {
  const origins = corsOrigin.split(",").map((o) => o.trim());
  return cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  });
}
