# Melodia — Sub-project 5: Credits, Pricing & Monetization (Paystack)

**Date:** 2026-03-14
**Status:** Draft
**Scope:** Paystack subscription integration, plan-gated credits with lazy reset, pricing page, billing management, webhook handler, payment history

---

## 1. Context

Sub-projects 1-4 built the full creation and discovery experience with a free credit system (5 songs/day). Sub-project 5 adds paid plans via Paystack — Ghana's native payment processor supporting GHS, Mobile Money, and cards.

**Dependencies:**
- `users.plan` column (free/creator/pro/enterprise) — already exists
- `users.credits_remaining` and `users.credits_reset_at` — already exist
- `credit_transactions` table — already exists
- Auth system (JWT, middleware) — already built
- Settings page — already built (to be extended)

---

## 2. Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Payment provider | Paystack | Ghana-native, GHS + Mobile Money support |
| Billing model | Paystack Subscriptions API | Paystack handles recurring, retries, dunning |
| Credit reset | Lazy reset on generation request | No Cron needed, zero overhead for inactive users |
| Checkout | Paystack hosted page | PCI-compliant, no card handling in our code |
| Webhook security | HMAC SHA-512 verification | Paystack standard, prevents spoofed webhooks |

---

## 3. New & Modified Files

### Backend

```
apps/api/src/
├── routes/
│   ├── billing.ts          # NEW: subscribe, cancel, status, history, webhook, callback
│   └── songs.ts            # MODIFY: add lazy credit reset before generation
├── services/
│   └── paystack.service.ts # NEW: Paystack API client + webhook verification
├── db/
│   ├── queries.ts          # EXTEND: payment, billing, plan update queries
│   └── schema.sql          # MODIFY: add payments table, user columns, index
└── index.ts                # MODIFY: mount billing routes (webhook is public, rest protected)
```

### Shared

```
packages/shared/src/
├── constants.ts            # MODIFY: add PLAN_CREDITS, PLAN_PRICES, PLAN_FEATURES
└── schemas/
    └── billing.ts          # NEW: SubscribeInput schema
```

### Frontend

```
apps/web/src/
├── pages/
│   ├── Pricing.tsx         # NEW: pricing cards (public page)
│   ├── Billing.tsx         # NEW: billing management (protected)
│   ├── BillingCallback.tsx # NEW: handles Paystack redirect, calls verify API
│   └── Settings.tsx        # MODIFY: add subscription section with link to billing
├── hooks/
│   └── useBilling.ts       # NEW: billing API methods (subscribe, cancel, status, history)
├── components/
│   └── Layout.tsx          # MODIFY: add Pricing to nav
└── App.tsx                 # MODIFY: add /pricing (public) and /billing (protected) routes
```

---

## 4. Schema Changes

### 4.1 New Columns on Users Table

Since D1/SQLite doesn't support ALTER TABLE ADD COLUMN with constraints well, these are added to the existing CREATE TABLE in schema.sql. For the production migration, a separate migration script handles existing data.

```sql
-- Add to users table definition:
paystack_customer_code TEXT,          -- Paystack customer ID (CUS_xxx)
paystack_subscription_code TEXT,      -- Active subscription code (SUB_xxx)
plan_expires_at TEXT,                 -- When cancelled plan period ends
```

### 4.2 New Payments Table

```sql
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paystack_reference TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,            -- Amount in pesewas (GHS * 100)
  currency TEXT DEFAULT 'GHS',
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  plan TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_paystack_sub ON users(paystack_subscription_code);
CREATE INDEX IF NOT EXISTS idx_users_paystack_cust ON users(paystack_customer_code);
```

---

## 5. Shared Package Extensions

### 5.1 Constants

```typescript
export const PLAN_CREDITS: Record<string, number> = {
  free: 5,
  creator: 50,
  pro: -1,      // -1 = unlimited
  enterprise: -1,
};

export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  creator: 15000,    // GHS 150.00 in pesewas
  pro: 45000,        // GHS 450.00 in pesewas
};

export const PLAN_FEATURES: Record<string, string[]> = {
  free: ["5 songs per day", "MP3 download only", "Non-commercial license"],
  creator: ["50 songs per day", "WAV + MP3 download", "Stem separation", "Commercial license"],
  pro: ["Unlimited songs", "WAV + MP3 + FLAC", "Full stems", "Commercial license", "API access", "Priority generation"],
  enterprise: ["Everything in Pro", "Dedicated GPU", "Custom model fine-tuning", "White-label", "SLA guarantees"],
};
```

### 5.2 Billing Schema

```typescript
// packages/shared/src/schemas/billing.ts
export const SubscribeSchema = v.object({
  plan: v.picklist(["creator", "pro"]),
});
export type SubscribeInput = v.InferInput<typeof SubscribeSchema>;
```

---

## 6. Paystack Service

### 6.1 API Client (`paystack.service.ts`)

All calls to `https://api.paystack.co` with `Authorization: Bearer {PAYSTACK_SECRET_KEY}`.

```typescript
// Initialize a transaction (redirects user to Paystack checkout)
initializeTransaction(secretKey, {
  email: string,
  amount: number,        // In pesewas
  callback_url: string,
  metadata: { userId: string, plan: string },
  plan?: string,         // Paystack plan code for subscriptions
}): Promise<{ authorization_url: string, reference: string }>

// Verify a completed transaction
verifyTransaction(secretKey, reference: string): Promise<PaystackTransaction>

// Disable (cancel) a subscription
disableSubscription(secretKey, subscriptionCode: string, emailToken: string): Promise<void>

// Get subscription details
getSubscription(secretKey, subscriptionCode: string): Promise<PaystackSubscription>

// Verify webhook signature
verifyWebhookSignature(rawBody: string, signature: string, secretKey: string): boolean
  → HMAC SHA-512 of rawBody with secretKey
  → Compare hex digest to signature header
```

### 6.2 Paystack Plan Codes

Plans are created in the Paystack dashboard (not via API). Store plan codes as environment variables:

```
PAYSTACK_PLAN_CREATOR=PLN_xxxxx    # Creator plan code
PAYSTACK_PLAN_PRO=PLN_xxxxx        # Pro plan code
```

These are referenced when initializing transactions.

---

## 7. Billing Routes

### 7.1 Subscribe

```
POST /api/billing/subscribe { plan: "creator" | "pro" }  (auth required)
  → Validate with SubscribeSchema
  → Get user from DB
  → If user already on this plan: return error
  → Get Paystack plan code from env (PAYSTACK_PLAN_CREATOR or PAYSTACK_PLAN_PRO)
  → Initialize transaction:
    - email: user.email (required — phone-only users must add email first)
    - amount: PLAN_PRICES[plan]
    - callback_url: {CORS_ORIGIN}/billing/callback?reference={ref}
    - metadata: { userId, plan }
    - plan: paystackPlanCode (enables auto-subscription after first payment)
  → Return { checkout_url: authorization_url, reference }
```

**Note:** Paystack requires an email for transactions. Phone-only users must add an email in Settings before subscribing. The route checks for this and returns a clear error.

### 7.2 Callback (verifies payment and activates plan)

**Flow clarification:** Paystack redirects the user's browser to the **frontend** page `/billing/callback?reference=xxx` (set as `callback_url` in Section 7.1). The frontend `BillingCallback.tsx` component then calls the **API** endpoint with the auth token. This avoids auth issues since the frontend has the Bearer token in memory.

```
POST /api/billing/verify { reference: "xxx" }  (auth required)
  → Verify transaction via Paystack API (verifyTransaction)
  → If successful:
    → INSERT payment record (INSERT OR IGNORE on paystack_reference — idempotency lock)
    → If insert succeeded (meta.changes === 1):
      → Update user: plan, paystack_customer_code, paystack_subscription_code
      → Reset credits to PLAN_CREDITS[plan]
      → Set credits_reset_at to next midnight UTC
      → Insert credit_transaction (amount: PLAN_CREDITS[plan], reason: 'purchase')
    → Return { success: true, plan }
  → If failed: return { success: false, error: "Payment failed" }
```

**Idempotency:** The payment INSERT uses `INSERT OR IGNORE` with the unique `paystack_reference`. If the webhook already processed this payment, the insert returns `changes === 0` and plan/credit updates are skipped (already done by webhook). This prevents double credits from concurrent callback + webhook processing.

### 7.3 Cancel

```
POST /api/billing/cancel  (auth required)
  → Get user's paystack_subscription_code
  → If no subscription: return error
  → Get subscription details from Paystack (to get email_token)
  → Disable subscription via Paystack API
  → Set plan_expires_at = current period end date
  → Return { cancelled: true, plan_expires_at }
```

User keeps their plan until `plan_expires_at`. The lazy reset in the generation endpoint handles downgrade after expiry.

### 7.4 Billing Status

```
GET /api/billing/status  (auth required)
  → Return {
    plan: user.plan,
    credits_remaining: user.credits_remaining,
    credits_max: PLAN_CREDITS[user.plan],
    credits_reset_at: user.credits_reset_at,
    plan_expires_at: user.plan_expires_at,
    has_subscription: !!user.paystack_subscription_code,
  }
```

### 7.5 Payment History

```
GET /api/billing/history  (auth required)
  → SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  → Return { payments: [...] }
```

### 7.6 Webhook

```
POST /api/billing/webhook  (public — verified by HMAC)
  → Read raw body as text
  → Verify x-paystack-signature header via HMAC SHA-512
  → If invalid: return 401
  → Parse JSON body
  → Handle events:

  charge.success:
    → Extract metadata.userId and metadata.plan from event.data
    → If metadata is missing (Paystack may not include it on renewals):
      → Fall back: find user by event.data.customer.customer_code
      → Use the user's current plan from the database
    → INSERT payment record (INSERT OR IGNORE for idempotency)
    → If insert succeeded (meta.changes === 1):
      → Reset credits to PLAN_CREDITS[plan]
      → Set credits_reset_at to next midnight
    → If first payment (already handled by callback): insert ignored, no duplicate processing

  subscription.disable:
    → Find user by paystack_customer_code from event.data.customer.customer_code (NOT subscription_code — it may already be cleared by a prior event)
    → Set plan_expires_at from event.data.current_period_end
    → Clear paystack_subscription_code

  subscription.not_renew:
    → Same lookup strategy as subscription.disable (by customer_code)
    → Set plan_expires_at, clear subscription_code

  invoice.payment_failed:
    → Log for monitoring
    → Optionally: could notify user via SMS (Hubtel) but deferred

  → Always return 200 (Paystack retries on non-200)
```

---

## 8. Lazy Credit Reset (songs.ts modification)

Add to the `POST /api/songs/generate` handler, BEFORE the credit deduction:

```typescript
async function ensureCreditsReset(db: D1Database, userId: string): Promise<void> {
  const user = await userQueries.findById(db, userId);
  if (!user) return;

  const now = new Date();

  // Check if cancelled plan has expired → downgrade to free
  if (user.plan_expires_at && now > new Date(user.plan_expires_at as string)) {
    await billingQueries.downgradePlan(db, userId);
    user.plan = 'free';
    user.plan_expires_at = null;
  }

  // Check if credits need resetting
  const resetAt = user.credits_reset_at ? new Date(user.credits_reset_at as string) : null;
  if (!resetAt || now > resetAt) {
    const planCredits = PLAN_CREDITS[user.plan as string] ?? 5;
    if (planCredits === -1) return; // Unlimited — no reset needed

    const nextMidnight = new Date(now);
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
    nextMidnight.setUTCHours(0, 0, 0, 0);

    await billingQueries.resetCredits(db, userId, planCredits, nextMidnight.toISOString());
  }
}
```

**Unlimited plan bypass in songs.ts generate endpoint:**

After calling `ensureCreditsReset`, the deduction block must be conditionally skipped for unlimited plans:

```typescript
const user = await userQueries.findById(db, userId);
await ensureCreditsReset(db, userId);

const planCredits = PLAN_CREDITS[user.plan as string] ?? 5;

if (planCredits === -1) {
  // Unlimited plan — skip credit deduction, still log the transaction
  const txId = ulid();
  await db.prepare(
    "INSERT INTO credit_transactions (id, user_id, amount, reason, song_id) VALUES (?, ?, 0, 'song_generation', ?)"
  ).bind(txId, userId, songId).run();
} else {
  // Limited plan — atomic credit deduction (existing logic)
  const deductResult = await db.prepare(
    "UPDATE users SET credits_remaining = credits_remaining - 1, updated_at = datetime('now') WHERE id = ? AND credits_remaining > 0"
  ).bind(userId).run();
  if (deductResult.meta.changes === 0) {
    throw new AppError("FORBIDDEN", "Insufficient credits", 403);
  }
  // ... existing batch: song creation + credit_transaction INSERT
}
```

---

## 9. Query Helpers

```typescript
export const billingQueries = {
  // Update user plan after successful payment
  updatePlan: (db, userId, { plan, customerCode, subscriptionCode }) =>
    db.prepare(
      `UPDATE users SET plan = ?, paystack_customer_code = ?,
       paystack_subscription_code = ?, plan_expires_at = NULL,
       updated_at = datetime('now') WHERE id = ?`
    ).bind(plan, customerCode, subscriptionCode, userId).run(),

  // Reset credits to plan limit
  resetCredits: (db, userId, credits, resetAt) =>
    db.prepare(
      `UPDATE users SET credits_remaining = ?, credits_reset_at = ?,
       updated_at = datetime('now') WHERE id = ?`
    ).bind(credits, resetAt, userId).run(),

  // Downgrade cancelled plan after expiry
  downgradePlan: (db, userId) =>
    db.prepare(
      `UPDATE users SET plan = 'free', paystack_subscription_code = NULL,
       plan_expires_at = NULL, updated_at = datetime('now') WHERE id = ?`
    ).bind(userId).run(),

  // Set plan expiry (on cancellation)
  setPlanExpiry: (db, userId, expiresAt) =>
    db.prepare(
      `UPDATE users SET plan_expires_at = ?, paystack_subscription_code = NULL,
       updated_at = datetime('now') WHERE id = ?`
    ).bind(expiresAt, userId).run(),

  // Insert payment record
  insertPayment: (db, payment: { id, user_id, paystack_reference, amount, currency, status, plan, period_start?, period_end? }) =>
    db.prepare(
      `INSERT INTO payments (id, user_id, paystack_reference, amount, currency, status, plan, period_start, period_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(...).run(),

  // Get payment history
  getPaymentHistory: (db, userId, limit = 20) =>
    db.prepare(
      "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    ).bind(userId, limit).all(),

  // Find user by subscription code (for webhooks)
  findBySubscriptionCode: (db, subscriptionCode) =>
    db.prepare(
      "SELECT * FROM users WHERE paystack_subscription_code = ?"
    ).bind(subscriptionCode).first(),

  // Find user by customer code (fallback for webhooks when sub code already cleared)
  findByCustomerCode: (db, customerCode) =>
    db.prepare(
      "SELECT * FROM users WHERE paystack_customer_code = ?"
    ).bind(customerCode).first(),
};
```

---

## 10. Frontend — Pricing Page (`/pricing`)

Public page with three pricing cards:

- **Free:** GHS 0/month — 5 songs/day, MP3 only, non-commercial. Button: "Current Plan" (if on free) or hidden (if already on paid plan).
- **Creator:** GHS 150/month — 50 songs/day, WAV+MP3, stems, commercial. Button: "Upgrade" → calls subscribe API, opens Paystack checkout.
- **Pro:** GHS 450/month — Unlimited songs, all formats, stems, API, priority. Button: "Upgrade" → same flow.

**Design:**
- Three cards in a row (stack on mobile)
- Current plan: teal border + "Current Plan" badge
- Upgrade buttons: amber
- Enterprise: "Contact us" link at bottom
- Feature list with checkmarks
- GHS currency symbol (₵) displayed

**Unauthenticated users:** Upgrade buttons redirect to `/register` first.

---

## 11. Frontend — Billing Page (`/billing`)

Protected page showing subscription management:

**Plan Card:**
- Current plan name + badge
- Credits: X / Y remaining (progress bar), "Unlimited" for Pro
- Next credit reset: relative time ("resets in 6 hours")
- Next billing date (if subscribed)
- "Change Plan" link → `/pricing`
- "Cancel Subscription" button (if subscribed) → confirmation dialog → calls cancel API
- Cancellation notice: "Your Creator plan will remain active until [date]"

**Payment History Table:**
- Date, Plan, Amount (formatted ₵XXX.XX), Status badge (✓ Success / ✗ Failed)
- Scrollable list, last 20 payments

**Callback handling:**
- URL `?upgraded=true` → show success toast "Plan upgraded successfully!"
- URL `?error=payment_failed` → show error toast

---

## 12. Frontend — Billing Callback Page

```
apps/web/src/pages/BillingCallback.tsx  # NEW: handles Paystack redirect
```

Route: `/billing/callback`

On mount:
- Extract `reference` from URL search params
- Call `GET /api/billing/callback?reference=xxx`
- API verifies and processes the payment
- Redirect to `/billing?upgraded=true` or `/billing?error=payment_failed`

---

## 13. New Secrets

```
PAYSTACK_SECRET_KEY    — sk_test_xxx (test) or sk_live_xxx (production)
PAYSTACK_PUBLIC_KEY    — pk_test_xxx (test) or pk_live_xxx (production)
PAYSTACK_PLAN_CREATOR  — PLN_xxx (created in Paystack dashboard)
PAYSTACK_PLAN_PRO      — PLN_xxx (created in Paystack dashboard)
```

Add to Env type in `types.ts`:
```typescript
PAYSTACK_SECRET_KEY: string;
PAYSTACK_PUBLIC_KEY: string;
PAYSTACK_PLAN_CREATOR: string;
PAYSTACK_PLAN_PRO: string;
```

---

## 14. Out of Scope (Deferred)

- Credit pack top-ups (one-time purchases)
- Plan downgrade flow (Creator → Free while keeping subscription active)
- Invoice PDF generation
- Email receipts (needs email provider)
- SMS payment notifications via Hubtel
- Enterprise plan self-service
- Annual billing (yearly discount)
- Promo codes / coupons

## 15. Known Limitations

- **Email required for Paystack:** Phone-only users must add an email in Settings before subscribing. The subscribe endpoint returns a clear error if no email.
- **No real-time plan update:** After Paystack checkout, the user is redirected to a callback that processes the payment. There's a brief moment between payment and plan activation.
- **Webhook idempotency:** The callback and webhook may both process the same payment. Payment insertion uses `paystack_reference TEXT UNIQUE` — duplicate insertions are rejected silently.
- **No dunning UI:** If Paystack fails to renew, the webhook logs it but doesn't notify the user. SMS notification can be added later via Hubtel.
- **Currency fixed to GHS:** No multi-currency support. Regional pricing (NGN, KES, ZAR) deferred to expansion phase.
