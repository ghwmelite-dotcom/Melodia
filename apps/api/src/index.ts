import { Hono } from "hono";
import type { Env, Variables } from "./types.js";
import { corsMiddleware } from "./middleware/cors.js";
import { AppError, errorResponse } from "./middleware/error-handler.js";
import { auth as authRoutes } from "./routes/auth.js";
import creditsRoutes from "./routes/credits.js";
import settingsRoutes from "./routes/settings.js";
import songsRoutes from "./routes/songs.js";
import lyricsRoutes from "./routes/lyrics.js";
import artworkRoutes from "./routes/artwork.js";
import playlistsRoutes from "./routes/playlists.js";
import usersRoutes from "./routes/users.js";

export { SongGenerationSession } from "./durable-objects/song-session.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use("*", async (c, next) => {
  const corsHandler = corsMiddleware(c.env.CORS_ORIGIN);
  return corsHandler(c, next);
});

// Global error handler — uses app.onError to catch errors from all sub-routers
app.onError((err, c) => {
  if (err instanceof AppError) {
    return errorResponse(c, err.code, err.message);
  }
  console.error("Unhandled error:", err);
  return errorResponse(c, "INTERNAL_ERROR", "An unexpected error occurred");
});

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Route mounting
app.route("/api/auth", authRoutes);
app.route("/api/credits", creditsRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/songs", songsRoutes);
app.route("/api/lyrics", lyricsRoutes);
app.route("/api/artwork", artworkRoutes);
app.route("/api/playlists", playlistsRoutes);
app.route("/api/users", usersRoutes);

// 404 fallback
app.notFound((c) =>
  c.json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } }, 404)
);

// Custom fetch handler — intercepts WebSocket upgrades for the DO,
// passes everything else to Hono (with ctx so waitUntil() works in middleware).
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade → forward to SongGenerationSession Durable Object
    const wsMatch = url.pathname.match(/^\/api\/songs\/([^/]+)\/live$/);
    if (wsMatch && request.headers.get("Upgrade") === "websocket") {
      const songId = wsMatch[1];
      const doId = env.SONG_SESSION.idFromName(songId);
      const stub = env.SONG_SESSION.get(doId);
      return stub.fetch(request);
    }

    // All other requests → Hono (include ctx for executionContext.waitUntil support)
    return app.fetch(request, env, ctx);
  },
};
