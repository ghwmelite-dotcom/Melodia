export type Env = {
  // Active in Sub-project 1
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  HUBTEL_CLIENT_ID: string;
  HUBTEL_CLIENT_SECRET: string;
  HUBTEL_SENDER_ID: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
  MAX_FREE_SONGS_PER_DAY: string;

  // Forward-declared for Sub-project 2+ (not bound in wrangler.toml yet)
  R2_BUCKET: R2Bucket;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  SONG_SESSION: DurableObjectNamespace;
  GENERATION_QUEUE: Queue;
  ACE_STEP_API_URL: string;
  ACE_STEP_API_KEY: string;
};

// Hono context variables set by middleware
export type Variables = {
  userId: string;
};
