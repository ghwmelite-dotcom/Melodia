// Plans
export const PLANS = ["free", "creator", "pro", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_CREDITS: Record<string, number> = {
  free: 5,
  creator: 50,
  pro: -1,
  enterprise: -1,
};

export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  creator: 15000,
  pro: 45000,
};

export const PLAN_FEATURES: Record<string, string[]> = {
  free: ["5 songs per day", "MP3 download only", "Non-commercial license"],
  creator: ["50 songs per day", "WAV + MP3 download", "Stem separation", "Commercial license"],
  pro: ["Unlimited songs", "WAV + MP3 + FLAC", "Full stems", "Commercial license", "API access", "Priority generation"],
  enterprise: ["Everything in Pro", "Dedicated GPU", "Custom model fine-tuning", "White-label", "SLA guarantees"],
};

export const PLAN_VARIATIONS: Record<string, number> = {
  free: 1,
  creator: 4,
  pro: 8,
  enterprise: 8,
};

// Song statuses
export const SONG_STATUSES = [
  "pending",
  "generating_lyrics",
  "generating_music",
  "generating_artwork",
  "processing",
  "completed",
  "failed",
] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];

// Auth methods
export const AUTH_METHODS = ["email", "phone", "google"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

// Credit reasons
export const CREDIT_REASONS = [
  "song_generation",
  "generation_refund",
  "daily_reset",
  "purchase",
  "referral",
  "signup_bonus",
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

// Limits
export const LIMITS = {
  FREE_CREDITS_PER_DAY: 5,
  OTP_MAX_ATTEMPTS: 3,
  OTP_EXPIRY_MINUTES: 5,
  OTP_RATE_LIMIT_PER_HOUR: 3,
  LOGIN_RATE_LIMIT_PER_HOUR: 10,
  ACCESS_TOKEN_EXPIRY_SECONDS: 15 * 60,
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
} as const;

// Genres
export const GENRES = [
  "afrobeats",
  "afro-fusion",
  "afro-soul",
  "highlife",
  "hiplife",
  "hip-hop",
  "rap",
  "r&b",
  "soul",
  "pop",
  "edm",
  "electronic",
  "dancehall",
  "reggae",
  "gospel",
  "worship",
  "jazz",
  "blues",
  "country",
  "folk",
  "rock",
  "alternative",
  "classical",
  "lo-fi",
  "trap",
  "drill",
  "amapiano",
  "kizomba",
  "zouk",
  "afro-house",
] as const;
export type Genre = (typeof GENRES)[number];

// Error codes
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "NOT_IMPLEMENTED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

// ACE-Step model types
export const ACE_STEP_MODELS = ["turbo", "sft", "base"] as const;
export type AceStepModel = (typeof ACE_STEP_MODELS)[number];

// Stage timeouts (milliseconds)
export const STAGE_TIMEOUTS = {
  REFERENCE: 30_000,
  BLUEPRINT: 30_000,
  LYRICS: 30_000,
  REFINEMENT: 30_000,
  MUSIC: 120_000,
  ARTWORK: 60_000,
  POST_PROCESSING: 30_000,
} as const;

// Workers AI model identifiers
export const AI_MODELS = {
  LYRICS_PRIMARY: "@cf/meta/llama-4-scout-17b-16e-instruct",
  LYRICS_FALLBACK: "@cf/qwen/qwen3-30b-a3b-fp8",
  ARTWORK: "@cf/black-forest-labs/flux-2-dev",
  WHISPER: "@cf/openai/whisper",
} as const;
