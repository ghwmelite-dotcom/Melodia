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

export const songQueries = {
  create: (
    db: D1Database,
    song: {
      id: string;
      user_id: string;
      title: string;
      user_prompt: string;
      genre?: string | null;
      mood?: string | null;
      vocal_language?: string | null;
      duration_seconds?: number | null;
    }
  ) =>
    db
      .prepare(
        `INSERT INTO songs (id, user_id, title, user_prompt, genre, mood, vocal_language, duration_seconds, generation_started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        song.id,
        song.user_id,
        song.title,
        song.user_prompt,
        song.genre ?? null,
        song.mood ?? null,
        song.vocal_language ?? null,
        song.duration_seconds ?? 180
      )
      .run(),

  findById: (db: D1Database, id: string) =>
    db.prepare("SELECT * FROM songs WHERE id = ?").bind(id).first(),

  findByIdAndUser: (db: D1Database, id: string, userId: string) =>
    db
      .prepare("SELECT * FROM songs WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .first(),

  listByUser: (
    db: D1Database,
    userId: string,
    opts: { status?: string; limit?: number; cursor?: string }
  ) => {
    const limit = Math.min(opts.limit ?? 20, 50);
    let sql = "SELECT * FROM songs WHERE user_id = ?";
    const params: (string | number)[] = [userId];

    if (opts.status) {
      sql += " AND status = ?";
      params.push(opts.status);
    }
    if (opts.cursor) {
      sql += " AND id < ?";
      params.push(opts.cursor);
    }
    sql += " ORDER BY id DESC LIMIT ?";
    params.push(limit + 1); // Fetch one extra to determine if there's a next page

    return db
      .prepare(sql)
      .bind(...params)
      .all();
  },

  updateStatus: (db: D1Database, id: string, status: string) =>
    db
      .prepare(
        "UPDATE songs SET status = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(status, id)
      .run(),

  updateTitle: (db: D1Database, id: string, title: string) =>
    db
      .prepare(
        "UPDATE songs SET title = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(title, id)
      .run(),

  updateCompleted: (
    db: D1Database,
    id: string,
    fields: {
      title: string;
      genre: string;
      sub_genre: string;
      mood: string;
      bpm: number;
      key_signature: string;
      time_signature: string;
      duration_seconds: number;
      vocal_style: string;
      vocal_language: string;
      instruments: string;
      style_tags: string;
      lyrics: string;
      lyrics_structured: string;
      audio_url: string;
      audio_format: string;
      artwork_url: string;
      artwork_prompt: string;
      waveform_url: string;
      ace_step_seed: number;
      ace_step_model: string;
      ace_step_steps: number;
      variation_count: number;
      reference_url?: string | null;
    }
  ) =>
    db
      .prepare(
        `UPDATE songs SET
          status = 'completed',
          title = ?, genre = ?, sub_genre = ?, mood = ?,
          bpm = ?, key_signature = ?, time_signature = ?,
          duration_seconds = ?, vocal_style = ?, vocal_language = ?,
          instruments = ?, style_tags = ?, lyrics = ?, lyrics_structured = ?,
          audio_url = ?, audio_format = ?, artwork_url = ?, artwork_prompt = ?,
          waveform_url = ?, ace_step_seed = ?, ace_step_model = ?, ace_step_steps = ?,
          variation_count = ?, reference_url = COALESCE(?, reference_url),
          generation_completed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?`
      )
      .bind(
        fields.title, fields.genre, fields.sub_genre, fields.mood,
        fields.bpm, fields.key_signature, fields.time_signature,
        fields.duration_seconds, fields.vocal_style, fields.vocal_language,
        fields.instruments, fields.style_tags, fields.lyrics, fields.lyrics_structured,
        fields.audio_url, fields.audio_format, fields.artwork_url, fields.artwork_prompt,
        fields.waveform_url, fields.ace_step_seed, fields.ace_step_model, fields.ace_step_steps,
        fields.variation_count, fields.reference_url ?? null,
        id
      )
      .run(),

  updateReferenceUrl: (db: D1Database, songId: string, referenceUrl: string) =>
    db
      .prepare("UPDATE songs SET reference_url = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(referenceUrl, songId)
      .run(),

  updateFailed: (db: D1Database, id: string) =>
    db
      .prepare(
        "UPDATE songs SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
      )
      .bind(id)
      .run(),

  delete: (db: D1Database, id: string) =>
    db.prepare("DELETE FROM songs WHERE id = ?").bind(id).run(),

  findByIdPublic: (db: D1Database, id: string) =>
    db.prepare("SELECT * FROM songs WHERE id = ?").bind(id).first(),

  update: (
    db: D1Database,
    id: string,
    fields: { is_public?: boolean; title?: string }
  ) => {
    const sets: string[] = ["updated_at = datetime('now')"];
    const values: (string | number | boolean | null)[] = [];
    if (fields.is_public !== undefined) {
      sets.push("is_public = ?");
      values.push(fields.is_public ? 1 : 0);
    }
    if (fields.title !== undefined) {
      sets.push("title = ?");
      values.push(fields.title);
    }
    values.push(id);
    return db
      .prepare(`UPDATE songs SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  },

  incrementPlayCount: (db: D1Database, id: string) =>
    db
      .prepare(
        "UPDATE songs SET play_count = play_count + 1, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(id)
      .run(),

  selectVariation: (db: D1Database, songId: string, variationIndex: number, audioUrl: string) =>
    db
      .prepare(
        `UPDATE songs SET variation_index = ?, audio_url = ?,
         updated_at = datetime('now') WHERE id = ?`
      )
      .bind(variationIndex, audioUrl, songId)
      .run(),

  updateVariationCount: (db: D1Database, songId: string, count: number) =>
    db
      .prepare(
        `UPDATE songs SET variation_count = ?, variation_index = 0,
         updated_at = datetime('now') WHERE id = ?`
      )
      .bind(count, songId)
      .run(),
};

export const exploreQueries = {
  newSongs: (
    db: D1Database,
    opts: { limit: number; cursor?: string; genre?: string }
  ) => {
    const limit = Math.min(opts.limit ?? 20, 50);
    let sql = `SELECT songs.*, users.username AS creator_username
               FROM songs
               JOIN users ON songs.user_id = users.id
               WHERE songs.is_public = 1`;
    const params: (string | number)[] = [];

    if (opts.genre) {
      sql += " AND songs.genre = ?";
      params.push(opts.genre);
    }
    if (opts.cursor) {
      sql += " AND songs.id < ?";
      params.push(opts.cursor);
    }
    sql += " ORDER BY songs.id DESC LIMIT ?";
    params.push(limit + 1);

    return db.prepare(sql).bind(...params).all();
  },

  popularSongs: (
    db: D1Database,
    opts: { limit: number; offset: number; genre?: string }
  ) => {
    const limit = Math.min(opts.limit ?? 20, 50);
    let sql = `SELECT songs.*, users.username AS creator_username
               FROM songs
               JOIN users ON songs.user_id = users.id
               WHERE songs.is_public = 1`;
    const params: (string | number)[] = [];

    if (opts.genre) {
      sql += " AND songs.genre = ?";
      params.push(opts.genre);
    }
    sql += " ORDER BY songs.play_count DESC, songs.id DESC LIMIT ? OFFSET ?";
    params.push(limit, opts.offset ?? 0);

    return db.prepare(sql).bind(...params).all();
  },
};

export const likeQueries = {
  like: (db: D1Database, userId: string, songId: string) =>
    db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO song_likes (user_id, song_id) VALUES (?, ?)"
        )
        .bind(userId, songId),
      db
        .prepare(
          "UPDATE songs SET like_count = like_count + 1, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(songId),
    ]),

  unlike: (db: D1Database, userId: string, songId: string) =>
    db
      .prepare("DELETE FROM song_likes WHERE user_id = ? AND song_id = ?")
      .bind(userId, songId)
      .run(),

  decrementLikeCount: (db: D1Database, songId: string) =>
    db
      .prepare(
        "UPDATE songs SET like_count = MAX(0, like_count - 1), updated_at = datetime('now') WHERE id = ?"
      )
      .bind(songId)
      .run(),

  isLiked: (db: D1Database, userId: string, songId: string) =>
    db
      .prepare("SELECT 1 FROM song_likes WHERE user_id = ? AND song_id = ?")
      .bind(userId, songId)
      .first(),

  likedSongs: (
    db: D1Database,
    userId: string,
    opts: { limit: number; offset: number }
  ) => {
    const limit = Math.min(opts.limit ?? 20, 50);
    return db
      .prepare(
        `SELECT songs.*, users.username AS creator_username
         FROM song_likes
         JOIN songs ON song_likes.song_id = songs.id
         JOIN users ON songs.user_id = users.id
         WHERE song_likes.user_id = ?
         ORDER BY song_likes.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(userId, limit, opts.offset ?? 0)
      .all();
  },
};

export const profileQueries = {
  findByUsername: (db: D1Database, username: string) =>
    db
      .prepare(
        "SELECT id, username, display_name, avatar_url, created_at FROM users WHERE username = ?"
      )
      .bind(username)
      .first(),

  countPublicSongs: (db: D1Database, userId: string) =>
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM songs WHERE user_id = ? AND is_public = 1"
      )
      .bind(userId)
      .first<{ count: number }>(),

  publicSongs: (
    db: D1Database,
    userId: string,
    opts: { limit: number; cursor?: string }
  ) => {
    const limit = Math.min(opts.limit ?? 20, 50);
    let sql =
      "SELECT * FROM songs WHERE user_id = ? AND is_public = 1";
    const params: (string | number)[] = [userId];

    if (opts.cursor) {
      sql += " AND id < ?";
      params.push(opts.cursor);
    }
    sql += " ORDER BY id DESC LIMIT ?";
    params.push(limit + 1);

    return db.prepare(sql).bind(...params).all();
  },
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

export const billingQueries = {
  updatePlan: (
    db: D1Database,
    userId: string,
    fields: { plan: string; customerCode: string; subscriptionCode: string }
  ) =>
    db
      .prepare(
        `UPDATE users SET plan = ?, paystack_customer_code = ?, paystack_subscription_code = ?,
         plan_expires_at = NULL, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(fields.plan, fields.customerCode, fields.subscriptionCode, userId)
      .run(),

  resetCredits: (db: D1Database, userId: string, credits: number, resetAt: string) =>
    db
      .prepare(
        "UPDATE users SET credits_remaining = ?, credits_reset_at = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(credits, resetAt, userId)
      .run(),

  downgradePlan: (db: D1Database, userId: string) =>
    db
      .prepare(
        `UPDATE users SET plan = 'free', paystack_customer_code = NULL,
         paystack_subscription_code = NULL, plan_expires_at = NULL,
         credits_remaining = 5, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(userId)
      .run(),

  setPlanExpiry: (db: D1Database, userId: string, expiresAt: string) =>
    db
      .prepare(
        "UPDATE users SET plan_expires_at = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(expiresAt, userId)
      .run(),

  insertPayment: (
    db: D1Database,
    payment: {
      id: string;
      user_id: string;
      paystack_reference: string;
      amount: number;
      currency: string;
      status: string;
      plan: string;
      period_start?: string | null;
      period_end?: string | null;
    }
  ) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO payments
         (id, user_id, paystack_reference, amount, currency, status, plan, period_start, period_end)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        payment.id,
        payment.user_id,
        payment.paystack_reference,
        payment.amount,
        payment.currency,
        payment.status,
        payment.plan,
        payment.period_start ?? null,
        payment.period_end ?? null
      )
      .run(),

  getPaymentHistory: (db: D1Database, userId: string, limit = 20) =>
    db
      .prepare(
        "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
      )
      .bind(userId, limit)
      .all(),

  findBySubscriptionCode: (db: D1Database, subscriptionCode: string) =>
    db
      .prepare("SELECT * FROM users WHERE paystack_subscription_code = ?")
      .bind(subscriptionCode)
      .first(),

  findByCustomerCode: (db: D1Database, customerCode: string) =>
    db
      .prepare("SELECT * FROM users WHERE paystack_customer_code = ?")
      .bind(customerCode)
      .first(),
};
