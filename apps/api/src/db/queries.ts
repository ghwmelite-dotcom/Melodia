export const userQueries = {
  findByEmail: (db: D1Database, email: string) =>
    db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first(),

  findByPhone: (db: D1Database, phone: string) =>
    db.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first(),

  findByGoogleId: (db: D1Database, googleId: string) =>
    db.prepare("SELECT * FROM users WHERE google_id = ?").bind(googleId).first(),

  findById: (db: D1Database, id: string) =>
    db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first(),

  findByUsername: (db: D1Database, username: string) =>
    db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first(),

  create: (
    db: D1Database,
    user: {
      id: string;
      email?: string | null;
      phone?: string | null;
      username: string;
      display_name?: string | null;
      avatar_url?: string | null;
      password_hash?: string | null;
      google_id?: string | null;
      primary_auth_method: string;
      is_verified: number;
    }
  ) =>
    db
      .prepare(
        `INSERT INTO users (id, email, phone, username, display_name, avatar_url, password_hash, google_id, primary_auth_method, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user.id,
        user.email ?? null,
        user.phone ?? null,
        user.username,
        user.display_name ?? null,
        user.avatar_url ?? null,
        user.password_hash ?? null,
        user.google_id ?? null,
        user.primary_auth_method,
        user.is_verified
      )
      .run(),

  updateProfile: (
    db: D1Database,
    id: string,
    fields: { username?: string; display_name?: string }
  ) => {
    const sets: string[] = ["updated_at = datetime('now')"];
    const values: (string | null)[] = [];
    if (fields.username !== undefined) {
      sets.push("username = ?");
      values.push(fields.username);
    }
    if (fields.display_name !== undefined) {
      sets.push("display_name = ?");
      values.push(fields.display_name);
    }
    values.push(id);
    return db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  },

  linkGoogleId: (db: D1Database, userId: string, googleId: string) =>
    db
      .prepare(
        "UPDATE users SET google_id = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(googleId, userId)
      .run(),

  updatePasswordHash: (db: D1Database, userId: string, hash: string) =>
    db
      .prepare(
        "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(hash, userId)
      .run(),
};

export const otpQueries = {
  create: (
    db: D1Database,
    otp: { id: string; phone: string; code: string; expires_at: string }
  ) =>
    db
      .prepare(
        "INSERT INTO otp_codes (id, phone, code, expires_at) VALUES (?, ?, ?, ?)"
      )
      .bind(otp.id, otp.phone, otp.code, otp.expires_at)
      .run(),

  invalidatePrevious: (db: D1Database, phone: string) =>
    db
      .prepare("UPDATE otp_codes SET used = 1 WHERE phone = ? AND used = 0")
      .bind(phone)
      .run(),

  findLatestValid: (db: D1Database, phone: string) =>
    db
      .prepare(
        `SELECT * FROM otp_codes
         WHERE phone = ? AND used = 0 AND expires_at > datetime('now')
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(phone)
      .first(),

  incrementAttempts: (db: D1Database, id: string) =>
    db
      .prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?")
      .bind(id)
      .run(),

  markUsed: (db: D1Database, id: string) =>
    db.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?").bind(id).run(),
};

export const refreshTokenQueries = {
  create: (
    db: D1Database,
    token: { id: string; user_id: string; token_hash: string; expires_at: string }
  ) =>
    db
      .prepare(
        "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
      )
      .bind(token.id, token.user_id, token.token_hash, token.expires_at)
      .run(),

  findByHash: (db: D1Database, tokenHash: string) =>
    db
      .prepare(
        "SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0"
      )
      .bind(tokenHash)
      .first(),

  revoke: (db: D1Database, id: string) =>
    db
      .prepare("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?")
      .bind(id)
      .run(),

  revokeAllForUser: (db: D1Database, userId: string) =>
    db
      .prepare(
        "UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0"
      )
      .bind(userId)
      .run(),
};

export const creditQueries = {
  getBalance: (db: D1Database, userId: string) =>
    db
      .prepare("SELECT credits_remaining, credits_reset_at FROM users WHERE id = ?")
      .bind(userId)
      .first(),

  getHistory: (db: D1Database, userId: string, limit = 50, offset = 0) =>
    db
      .prepare(
        "SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      )
      .bind(userId, limit, offset)
      .all(),
};
