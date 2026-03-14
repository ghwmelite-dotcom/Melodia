-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  primary_auth_method TEXT NOT NULL DEFAULT 'email' CHECK (primary_auth_method IN ('email', 'phone', 'google')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'creator', 'pro', 'enterprise')),
  credits_remaining INTEGER DEFAULT 5,
  credits_reset_at TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- OTP Codes
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Songs
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating_lyrics', 'generating_music', 'generating_artwork', 'processing', 'completed', 'failed')),
  user_prompt TEXT NOT NULL,
  lyrics TEXT,
  lyrics_structured TEXT,
  genre TEXT,
  sub_genre TEXT,
  mood TEXT,
  style_tags TEXT,
  bpm INTEGER,
  key_signature TEXT,
  time_signature TEXT DEFAULT '4/4',
  duration_seconds INTEGER DEFAULT 180,
  vocal_style TEXT,
  vocal_language TEXT DEFAULT 'en',
  instruments TEXT,
  audio_url TEXT,
  audio_format TEXT DEFAULT 'wav',
  stems_url TEXT,
  waveform_url TEXT,
  artwork_url TEXT,
  artwork_prompt TEXT,
  ace_step_seed INTEGER,
  ace_step_model TEXT DEFAULT 'turbo',
  ace_step_steps INTEGER DEFAULT 8,
  variation_group_id TEXT,
  variation_index INTEGER DEFAULT 0,
  is_selected_variation BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  play_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  generation_started_at TEXT,
  generation_completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, song_id)
);

-- Likes
CREATE TABLE IF NOT EXISTS song_likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, song_id)
);

-- Credit Transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('song_generation', 'daily_reset', 'purchase', 'referral', 'signup_bonus')),
  song_id TEXT REFERENCES songs(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Style Presets
CREATE TABLE IF NOT EXISTS style_presets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  style_tags TEXT NOT NULL,
  lora_path TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, used, expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_songs_user ON songs(user_id);
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
CREATE INDEX IF NOT EXISTS idx_songs_public ON songs(is_public, play_count DESC);
CREATE INDEX IF NOT EXISTS idx_songs_variation ON songs(variation_group_id);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_user ON credit_transactions(user_id);
