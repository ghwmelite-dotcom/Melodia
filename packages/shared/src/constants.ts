// Plans
export const PLANS = ["free", "creator", "pro", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

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
