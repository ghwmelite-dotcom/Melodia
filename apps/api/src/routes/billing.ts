import { Hono } from "hono";
import { ulid } from "ulidx";
import * as v from "valibot";
import { SubscribeSchema, PLAN_CREDITS, PLAN_PRICES } from "@melodia/shared";
import type { Env, Variables } from "../types.js";
import { AppError } from "../middleware/error-handler.js";
import { authGuard } from "../middleware/auth.js";
import { userQueries } from "../db/queries.js";
import { billingQueries } from "../db/queries.js";
import {
  initializeTransaction,
  verifyTransaction,
  getSubscription,
  disableSubscription,
  verifyWebhookSignature,
} from "../services/paystack.service.js";

type HonoContext = { Bindings: Env; Variables: Variables };

const billing = new Hono<HonoContext>();

// ----------------------------------------------------------------------------
// POST /subscribe  (authGuard) — initializes a Paystack checkout session
// ----------------------------------------------------------------------------
billing.post("/subscribe", authGuard(), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const result = v.safeParse(SubscribeSchema, body);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.issues.map((i) => i.message).join(", "),
      400
    );
  }

  const { plan } = result.output;
  const userId = c.get("userId");

  const user = (await userQueries.findById(c.env.DB, userId)) as {
    id: string;
    email: string | null;
    plan: string;
  } | null;

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  if (!user.email) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A verified email address is required to subscribe. Please add an email to your account.",
      400
    );
  }

  if (user.plan === plan) {
    throw new AppError("VALIDATION_ERROR", `You are already on the ${plan} plan`, 400);
  }

  const planCode =
    plan === "creator" ? c.env.PAYSTACK_PLAN_CREATOR : c.env.PAYSTACK_PLAN_PRO;

  const callbackUrl = `${c.env.CORS_ORIGIN}/billing/callback`;

  const txData = await initializeTransaction(c.env.PAYSTACK_SECRET_KEY, {
    email: user.email,
    amount: PLAN_PRICES[plan] ?? 0,
    callback_url: callbackUrl,
    metadata: { user_id: userId, plan },
    plan: planCode,
  });

  return c.json({ success: true, checkout_url: txData.authorization_url, reference: txData.reference });
});

// ----------------------------------------------------------------------------
// POST /verify  (authGuard) — verifies a Paystack transaction after redirect
// ----------------------------------------------------------------------------
billing.post("/verify", authGuard(), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
  });

  const { reference } = body as { reference?: string };
  if (!reference || typeof reference !== "string") {
    throw new AppError("VALIDATION_ERROR", "reference is required", 400);
  }

  const userId = c.get("userId");

  const txData = await verifyTransaction(c.env.PAYSTACK_SECRET_KEY, reference);

  if (txData.status !== "success") {
    throw new AppError("FORBIDDEN", "Transaction was not successful", 403);
  }

  const meta = (txData.metadata ?? {}) as Record<string, string>;
  const plan = (meta.plan ?? (txData.plan as string | null) ?? "creator") as string;

  const customerCode = (
    (txData.customer as Record<string, unknown> | null)?.customer_code ?? ""
  ) as string;

  const subscriptionCode = (txData.subscription_code ?? "") as string;

  // Idempotent payment insert
  const paymentId = ulid();
  const insertResult = await billingQueries.insertPayment(c.env.DB, {
    id: paymentId,
    user_id: userId,
    paystack_reference: reference,
    amount: (txData.amount as number) ?? 0,
    currency: (txData.currency as string) ?? "GHS",
    status: "success",
    plan,
    period_start: null,
    period_end: null,
  });

  // Only update plan + credits if this is a new payment (not a duplicate)
  if (insertResult.meta.changes === 1) {
    const credits = PLAN_CREDITS[plan] ?? 5;
    const nextMidnight = new Date();
    nextMidnight.setUTCHours(24, 0, 0, 0);
    const resetAt = nextMidnight.toISOString().replace("T", " ").slice(0, 19);

    await billingQueries.updatePlan(c.env.DB, userId, {
      plan,
      customerCode,
      subscriptionCode,
    });

    if (credits !== -1) {
      await billingQueries.resetCredits(c.env.DB, userId, credits, resetAt);
    }

    // Log credit transaction
    const txId = ulid();
    await c.env.DB.prepare(
      "INSERT INTO credit_transactions (id, user_id, amount, reason) VALUES (?, ?, ?, 'purchase')"
    )
      .bind(txId, userId, credits === -1 ? 0 : credits)
      .run();
  }

  return c.json({ success: true, plan });
});

// ----------------------------------------------------------------------------
// POST /cancel  (authGuard) — disables the active Paystack subscription
// ----------------------------------------------------------------------------
billing.post("/cancel", authGuard(), async (c) => {
  const userId = c.get("userId");

  const user = (await userQueries.findById(c.env.DB, userId)) as {
    id: string;
    paystack_subscription_code: string | null;
  } | null;

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  if (!user.paystack_subscription_code) {
    throw new AppError("VALIDATION_ERROR", "No active subscription found", 400);
  }

  const subData = await getSubscription(
    c.env.PAYSTACK_SECRET_KEY,
    user.paystack_subscription_code
  );

  const emailToken = subData.email_token as string;
  await disableSubscription(
    c.env.PAYSTACK_SECRET_KEY,
    user.paystack_subscription_code,
    emailToken
  );

  // Set plan expiry to current period end so access continues until renewal date
  const nextPaymentDate = (subData.next_payment_date ?? null) as string | null;
  const planExpiresAt = nextPaymentDate ?? new Date().toISOString().replace("T", " ").slice(0, 19);

  await billingQueries.setPlanExpiry(c.env.DB, userId, planExpiresAt);

  return c.json({ success: true, cancelled: true, plan_expires_at: planExpiresAt });
});

// ----------------------------------------------------------------------------
// GET /status  (authGuard) — returns current billing status for the user
// ----------------------------------------------------------------------------
billing.get("/status", authGuard(), async (c) => {
  const userId = c.get("userId");

  const user = (await userQueries.findById(c.env.DB, userId)) as {
    id: string;
    plan: string;
    credits_remaining: number;
    credits_reset_at: string | null;
    plan_expires_at: string | null;
    paystack_subscription_code: string | null;
  } | null;

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", 404);
  }

  const planMax = PLAN_CREDITS[user.plan] ?? 5;

  return c.json({
    success: true,
    plan: user.plan,
    credits_remaining: user.credits_remaining,
    credits_max: planMax,
    credits_reset_at: user.credits_reset_at,
    plan_expires_at: user.plan_expires_at,
    has_subscription: user.paystack_subscription_code !== null,
  });
});

// ----------------------------------------------------------------------------
// GET /history  (authGuard) — returns payment history
// ----------------------------------------------------------------------------
billing.get("/history", authGuard(), async (c) => {
  const userId = c.get("userId");
  const { limit: limitStr } = c.req.query();
  const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 100);

  const result = await billingQueries.getPaymentHistory(c.env.DB, userId, limit);

  return c.json({ success: true, payments: result.results ?? [] });
});

// ----------------------------------------------------------------------------
// POST /webhook  (NO auth — HMAC-SHA512 verified)
// IMPORTANT: raw body MUST be read before JSON parsing for signature verification
// Always returns 200 so Paystack does not retry
// ----------------------------------------------------------------------------
billing.post("/webhook", async (c) => {
  // Read raw body as text first (required for HMAC verification)
  const rawBody = await c.req.text();
  const signature = c.req.header("x-paystack-signature") ?? "";

  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    c.env.PAYSTACK_SECRET_KEY
  );

  if (!isValid) {
    // Return 200 to prevent retries, but do not process the event
    return c.json({ received: true }, 200);
  }

  let event: { event: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return c.json({ received: true }, 200);
  }

  const { event: eventType, data } = event;

  try {
    if (eventType === "charge.success") {
      // Idempotent payment record from webhook
      const reference = (data.reference as string) ?? "";
      const customerData = (data.customer ?? {}) as Record<string, unknown>;
      const customerCode = (customerData.customer_code as string) ?? "";
      const metaData = (data.metadata ?? {}) as Record<string, string>;
      const plan = metaData.plan ?? (data.plan as string | null) ?? "creator";
      const amount = (data.amount as number) ?? 0;
      const currency = (data.currency as string) ?? "GHS";

      if (reference && customerCode) {
        const user = (await billingQueries.findByCustomerCode(
          c.env.DB,
          customerCode
        )) as { id: string; plan: string } | null;

        if (user) {
          const paymentId = ulid();
          const insertResult = await billingQueries.insertPayment(c.env.DB, {
            id: paymentId,
            user_id: user.id,
            paystack_reference: reference,
            amount,
            currency,
            status: "success",
            plan,
            period_start: null,
            period_end: null,
          });

          if (insertResult.meta.changes === 1) {
            // New subscription renewal — reset credits
            const credits = PLAN_CREDITS[plan] ?? 5;
            if (credits !== -1) {
              const nextMidnight = new Date();
              nextMidnight.setUTCHours(24, 0, 0, 0);
              const resetAt = nextMidnight.toISOString().replace("T", " ").slice(0, 19);
              await billingQueries.resetCredits(c.env.DB, user.id, credits, resetAt);
            }
          }
        }
      }
    } else if (
      eventType === "subscription.disable" ||
      eventType === "subscription.not_renew"
    ) {
      // Use customer_code to find user (subscription_code may be cleared)
      const customerData = (data.customer ?? {}) as Record<string, unknown>;
      const customerCode = (customerData.customer_code as string) ?? "";

      if (customerCode) {
        const user = (await billingQueries.findByCustomerCode(
          c.env.DB,
          customerCode
        )) as { id: string; plan_expires_at: string | null } | null;

        if (user) {
          // If no expiry is already set, downgrade immediately
          if (!user.plan_expires_at) {
            await billingQueries.downgradePlan(c.env.DB, user.id);
          }
        }
      }
    } else if (eventType === "invoice.payment_failed") {
      const reference = (data.reference as string) ?? ulid();
      const customerData = (data.customer ?? {}) as Record<string, unknown>;
      const customerCode = (customerData.customer_code as string) ?? "";
      const metaData = (data.metadata ?? {}) as Record<string, string>;
      const plan = metaData.plan ?? "creator";
      const amount = (data.amount as number) ?? 0;
      const currency = (data.currency as string) ?? "GHS";

      if (customerCode) {
        const user = (await billingQueries.findByCustomerCode(
          c.env.DB,
          customerCode
        )) as { id: string } | null;

        if (user) {
          const paymentId = ulid();
          await billingQueries.insertPayment(c.env.DB, {
            id: paymentId,
            user_id: user.id,
            paystack_reference: reference,
            amount,
            currency,
            status: "failed",
            plan,
            period_start: null,
            period_end: null,
          });
        }
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Still return 200 — errors should not cause Paystack to retry
  }

  return c.json({ received: true }, 200);
});

export default billing;
