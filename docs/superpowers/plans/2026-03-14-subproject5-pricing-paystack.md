# Sub-project 5: Credits, Pricing & Monetization (Paystack) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paid subscription plans (Creator GHS 150/mo, Pro GHS 450/mo) via Paystack, with lazy daily credit reset, pricing page, billing management, and webhook-driven subscription lifecycle.

**Architecture:** Paystack Subscriptions API handles recurring billing. A webhook endpoint verifies HMAC signatures and processes charge/subscription events. The generate endpoint adds lazy credit reset (check `credits_reset_at`, reset if expired) and unlimited plan bypass. Frontend adds Pricing page (public), Billing page (protected), and callback handler.

**Tech Stack:** Paystack REST API, HMAC SHA-512 (Web Crypto), D1, KV, Hono, React, Tailwind CSS, `@melodia/shared`

**Spec:** `docs/superpowers/specs/2026-03-14-melodia-subproject5-pricing-paystack-design.md`

---

## Chunk 1: Backend — Schema, Shared, Paystack Service, Queries

### Task 1: Schema + Shared Package Extensions

**Files:**
- Modify: `apps/api/src/db/schema.sql`
- Modify: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/schemas/billing.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add new columns to users table in schema.sql**

Add these columns to the existing `CREATE TABLE users` definition, before `created_at`:

```sql
paystack_customer_code TEXT,
paystack_subscription_code TEXT,
plan_expires_at TEXT,
```

- [ ] **Step 2: Add payments table + indexes to schema.sql**

Append after existing tables:

```sql
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paystack_reference TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
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

- [ ] **Step 3: Add plan constants to constants.ts**

```typescript
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
```

- [ ] **Step 4: Create billing schema**

Create `packages/shared/src/schemas/billing.ts`:

```typescript
import * as v from "valibot";

export const SubscribeSchema = v.object({
  plan: v.picklist(["creator", "pro"]),
});
export type SubscribeInput = v.InferInput<typeof SubscribeSchema>;
```

Export from `packages/shared/src/index.ts`.

- [ ] **Step 5: Re-run migration + typecheck**

```bash
cd apps/api && npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
npm run typecheck -w packages/shared
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/ apps/api/src/db/schema.sql
git commit -m "feat: add payments table, plan constants, billing schema"
```

---

### Task 2: Env Type + Paystack Service

**Files:**
- Modify: `apps/api/src/types.ts`
- Create: `apps/api/src/services/paystack.service.ts`

- [ ] **Step 1: Add Paystack secrets to Env type**

Add to the "Active in Sub-project 1" section of `apps/api/src/types.ts`:

```typescript
PAYSTACK_SECRET_KEY: string;
PAYSTACK_PUBLIC_KEY: string;
PAYSTACK_PLAN_CREATOR: string;
PAYSTACK_PLAN_PRO: string;
```

- [ ] **Step 2: Create Paystack service**

Create `apps/api/src/services/paystack.service.ts`:

```typescript
const PAYSTACK_BASE = "https://api.paystack.co";

type InitializeParams = {
  email: string;
  amount: number;
  callback_url: string;
  metadata: Record<string, string>;
  plan?: string;
};

export async function initializeTransaction(
  secretKey: string,
  params: InitializeParams
): Promise<{ authorization_url: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const data = await res.json() as any;
  if (!data.status) throw new Error(data.message || "Failed to initialize transaction");
  return data.data;
}

export async function verifyTransaction(
  secretKey: string,
  reference: string
): Promise<any> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json() as any;
  if (!data.status) throw new Error(data.message || "Verification failed");
  return data.data;
}

export async function getSubscription(
  secretKey: string,
  subscriptionCode: string
): Promise<any> {
  const res = await fetch(`${PAYSTACK_BASE}/subscription/${encodeURIComponent(subscriptionCode)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json() as any;
  if (!data.status) throw new Error(data.message || "Failed to get subscription");
  return data.data;
}

export async function disableSubscription(
  secretKey: string,
  code: string,
  token: string
): Promise<void> {
  const res = await fetch(`${PAYSTACK_BASE}/subscription/disable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, token }),
  });
  const data = await res.json() as any;
  if (!data.status) throw new Error(data.message || "Failed to disable subscription");
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  );
  const hex = Array.from(sig).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/services/paystack.service.ts
git commit -m "feat(api): add Paystack service — transaction, subscription, webhook HMAC"
```

---

### Task 3: Billing Query Helpers

**Files:**
- Modify: `apps/api/src/db/queries.ts`

- [ ] **Step 1: Add billingQueries to queries.ts**

Read existing queries.ts. Add the complete `billingQueries` namespace from spec Section 9:
- `updatePlan(db, userId, { plan, customerCode, subscriptionCode })`
- `resetCredits(db, userId, credits, resetAt)`
- `downgradePlan(db, userId)`
- `setPlanExpiry(db, userId, expiresAt)`
- `insertPayment(db, payment)` — uses INSERT OR IGNORE for idempotency
- `getPaymentHistory(db, userId, limit)`
- `findBySubscriptionCode(db, subscriptionCode)`
- `findByCustomerCode(db, customerCode)`

All using prepared statements with proper `.bind()`.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/queries.ts
git commit -m "feat(api): add billing query helpers for plan, credit, and payment management"
```

---

### Task 4: Billing Routes

**Files:**
- Create: `apps/api/src/routes/billing.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create billing routes**

Create `apps/api/src/routes/billing.ts` with all 6 endpoints from spec Section 7:

**POST /subscribe** (authGuard):
- Validate with SubscribeSchema
- Check user has email (phone-only users → error with clear message)
- Check not already on this plan
- Get plan code from env (`PAYSTACK_PLAN_CREATOR` or `PAYSTACK_PLAN_PRO`)
- Get callback URL: `${CORS_ORIGIN}/billing/callback`
- Call `initializeTransaction` with email, amount, callback_url, metadata, plan code
- Return `{ checkout_url, reference }`

**POST /verify** (authGuard):
- Extract `reference` from body
- Call `verifyTransaction`
- If successful: INSERT OR IGNORE payment, if changes === 1 → updatePlan + resetCredits + insert credit_transaction
- Return `{ success: true, plan }` or error

**POST /cancel** (authGuard):
- Get user's subscription code, error if none
- Call `getSubscription` to get email_token
- Call `disableSubscription`
- Call `setPlanExpiry` with current period end
- Return `{ cancelled: true, plan_expires_at }`

**GET /status** (authGuard):
- Return plan, credits, reset time, expiry, has_subscription boolean

**GET /history** (authGuard):
- Return payment history from billingQueries.getPaymentHistory

**POST /webhook** (NO auth — HMAC verified):
- Read raw body as text
- Verify signature via `verifyWebhookSignature`
- Parse JSON, handle events: `charge.success`, `subscription.disable`, `subscription.not_renew`, `invoice.payment_failed`
- Use idempotent payment INSERT for charge.success
- Use findByCustomerCode for subscription events (not subscription_code)
- Always return 200

- [ ] **Step 2: Mount billing routes in index.ts**

Add to `apps/api/src/index.ts`:
```typescript
import billingRoutes from "./routes/billing.js";
app.route("/api/billing", billingRoutes);
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/index.ts
git commit -m "feat(api): add billing routes — subscribe, verify, cancel, status, history, webhook"
```

---

### Task 5: Lazy Credit Reset + Unlimited Plan Bypass

**Files:**
- Modify: `apps/api/src/routes/songs.ts`

- [ ] **Step 1: Add ensureCreditsReset function and modify generate endpoint**

Read existing songs.ts. Add the `ensureCreditsReset` function from spec Section 8 (handles plan expiry downgrade + credit reset).

Modify `POST /generate` handler:
1. Call `ensureCreditsReset(c.env.DB, userId)` before the existing credit deduction
2. Re-fetch user to get current plan after potential reset
3. Check `PLAN_CREDITS[user.plan]`:
   - If `-1` (unlimited): skip credit deduction, log zero-amount credit_transaction
   - Otherwise: proceed with existing atomic deduction logic

Import `PLAN_CREDITS` from `@melodia/shared` and `billingQueries` from queries.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck -w apps/api
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/songs.ts
git commit -m "feat(api): add lazy credit reset and unlimited plan bypass to generate endpoint"
```

---

## Chunk 2: Frontend — Pricing, Billing, Callback, Integration

### Task 6: useBilling Hook

**Files:**
- Create: `apps/web/src/hooks/useBilling.ts`

- [ ] **Step 1: Create useBilling hook**

Returns plain async functions (same pattern as useSongs):

```typescript
export function useBilling() {
  return {
    subscribe: async (plan: string) => {
      return api.post<{ checkout_url: string; reference: string }>("/billing/subscribe", { plan });
    },
    verify: async (reference: string) => {
      return api.post<{ plan: string }>("/billing/verify", { reference });
    },
    cancel: async () => {
      return api.post<{ cancelled: boolean; plan_expires_at: string }>("/billing/cancel");
    },
    getStatus: async () => {
      return api.get<{
        plan: string;
        credits_remaining: number;
        credits_max: number;
        credits_reset_at: string | null;
        plan_expires_at: string | null;
        has_subscription: boolean;
      }>("/billing/status");
    },
    getHistory: async () => {
      return api.get<{ payments: any[] }>("/billing/history");
    },
  };
}
```

Adapt to actual API response shapes after reading `billing.ts` routes.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useBilling.ts
git commit -m "feat(web): add useBilling hook for subscription and payment management"
```

---

### Task 7: Pricing Page

**Files:**
- Create: `apps/web/src/pages/Pricing.tsx`

- [ ] **Step 1: Create Pricing page**

Public page at `/pricing` with three pricing cards:

- Uses `PLAN_FEATURES` and `PLAN_PRICES` from `@melodia/shared`
- Three cards: Free, Creator, Pro. Responsive (stack on mobile, row on desktop).
- Current plan highlighted with teal border + "Current Plan" badge (check `useAuth().user?.plan`)
- Upgrade buttons (amber): call `useBilling().subscribe(plan)`, then `window.location.href = checkout_url`
- If not authenticated: upgrade buttons navigate to `/register`
- Feature list with checkmark icons
- Price displayed as `₵150/month` (format pesewas to GHS)
- Enterprise section at bottom: "Need more? Contact us" with email link
- Design: cards on charcoal background, surface-1 cards, amber buttons, teal for current plan

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Pricing.tsx
git commit -m "feat(web): add Pricing page with plan cards and Paystack checkout"
```

---

### Task 8: Billing Callback + Billing Page

**Files:**
- Create: `apps/web/src/pages/BillingCallback.tsx`
- Create: `apps/web/src/pages/Billing.tsx`

- [ ] **Step 1: Create BillingCallback page**

Route: `/billing/callback`

On mount:
- Extract `reference` from URL search params
- If no reference: redirect to `/billing`
- Call `useBilling().verify(reference)` via `useApi().call()`
- On success: call `useAuth().refresh()` to update user data, navigate to `/billing?upgraded=true`
- On error: navigate to `/billing?error=payment_failed`
- Show spinner during verification

- [ ] **Step 2: Create Billing page**

Route: `/billing` (protected)

**Plan card:**
- Fetch status via `useBilling().getStatus()`
- Display: plan name (capitalized) with colored badge, credits (X/Y with progress bar, or "Unlimited"), reset time (relative), plan_expires_at notice if cancelling
- "Change Plan" link to `/pricing`
- "Cancel Subscription" button (only if has_subscription): confirmation via `window.confirm()`, calls `cancel()`, refreshes status
- Success/error toasts from URL params (`?upgraded=true` or `?error=payment_failed`)

**Payment history:**
- Fetch via `useBilling().getHistory()`
- Table: Date (formatted), Plan, Amount (₵XXX.XX), Status badge (✓ teal / ✗ coral)
- If no payments: "No payment history"

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/BillingCallback.tsx apps/web/src/pages/Billing.tsx
git commit -m "feat(web): add BillingCallback and Billing pages for subscription management"
```

---

### Task 9: Settings Update + Routes + Nav

**Files:**
- Modify: `apps/web/src/pages/Settings.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Layout.tsx`

- [ ] **Step 1: Update Settings with subscription section**

Read existing Settings.tsx. Add a "Subscription" card section:
- Shows current plan badge
- Credits remaining / max
- "Manage Subscription →" link to `/billing`
- "Upgrade" button to `/pricing` (if on free plan)

- [ ] **Step 2: Add routes to App.tsx**

Add:
- `/pricing` as public route (inside Layout but outside AuthGuard)
- `/billing` as protected route (inside AuthGuard + Layout)
- `/billing/callback` as protected route (inside AuthGuard but can be outside Layout since it auto-redirects)

- [ ] **Step 3: Update Layout nav**

Add "Pricing" link visible to all users (authenticated and unauthenticated). Position it after Explore.

- [ ] **Step 4: Verify build**

```bash
npm run typecheck -w apps/web
npm run build -w apps/web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Settings.tsx apps/web/src/App.tsx apps/web/src/components/Layout.tsx
git commit -m "feat(web): add Pricing/Billing routes, nav link, Settings subscription section"
```

---

### Task 10: Integration Test + Push

- [ ] **Step 1: Update .dev.vars with Paystack test keys**

Add to `apps/api/.dev.vars`:
```
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_PLAN_CREATOR=PLN_test_creator
PAYSTACK_PLAN_PRO=PLN_test_pro
```

- [ ] **Step 2: Re-run migration**

```bash
cd apps/api && npx wrangler d1 execute melodia-db --local --file=src/db/schema.sql
```

- [ ] **Step 3: Start API and test backend**

```bash
npx wrangler dev --port 8787
```

Test:
1. `GET /api/billing/status` — should return free plan with 5 credits
2. `POST /api/billing/subscribe { "plan": "creator" }` — should return checkout_url (will fail with test keys but validates the flow)
3. `GET /api/billing/history` — should return empty payments

- [ ] **Step 4: Verify frontend**

```bash
npm run build -w apps/web
```

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "chore: verify Sub-project 5 integration — billing endpoints and frontend"
git push
```

---

**End of plan. Total: 10 tasks across 2 chunks.**
