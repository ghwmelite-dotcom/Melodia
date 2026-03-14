import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useBilling, type BillingStatus, type Payment } from "../hooks/useBilling";
import { useApi } from "../hooks/useApi";
import { PLAN_CREDITS } from "@melodia/shared";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatGHS(pesewas: number): string {
  return `₵${(pesewas / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

const PLAN_LABELS: Record<string, string> = {
  free:       "Free",
  creator:    "Creator",
  pro:        "Pro",
  enterprise: "Enterprise",
};

const PLAN_BADGE_STYLES: Record<string, React.CSSProperties> = {
  free: {
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#9ca3af",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  creator: {
    backgroundColor: "rgba(240,165,0,0.12)",
    color: "var(--color-amber)",
    border: "1px solid rgba(240,165,0,0.3)",
  },
  pro: {
    backgroundColor: "rgba(0,210,255,0.1)",
    color: "var(--color-teal)",
    border: "1px solid rgba(0,210,255,0.3)",
  },
  enterprise: {
    backgroundColor: "rgba(0,210,255,0.1)",
    color: "var(--color-teal)",
    border: "1px solid rgba(0,210,255,0.3)",
  },
};

// ─── Toast ───────────────────────────────────────────────────────────────────

interface ToastProps {
  type: "success" | "error";
  message: string;
  onClose: () => void;
}

function Toast({ type, message, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-medium shadow-2xl max-w-sm w-full"
      style={
        type === "success"
          ? {
              backgroundColor: "rgba(0,210,255,0.12)",
              color: "var(--color-teal)",
              border: "1px solid rgba(0,210,255,0.25)",
              backdropFilter: "blur(12px)",
            }
          : {
              backgroundColor: "rgba(231,76,60,0.12)",
              color: "var(--color-coral)",
              border: "1px solid rgba(231,76,60,0.25)",
              backdropFilter: "blur(12px)",
            }
      }
      role="alert"
    >
      <span className="text-lg">{type === "success" ? "✓" : "✗"}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="opacity-60 hover:opacity-100 transition-opacity text-xl leading-none cursor-pointer"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

// ─── Credits ring (CSS conic-gradient) ───────────────────────────────────────

function CreditsRing({
  remaining,
  max,
}: {
  remaining: number;
  max: number;
}) {
  const pct   = max > 0 ? Math.max(0, Math.min(100, (remaining / max) * 100)) : 0;
  const isLow = pct <= 20;
  const color = isLow ? "var(--color-coral)" : "var(--color-amber)";

  return (
    <div className="flex items-center gap-5">
      {/* Conic ring */}
      <div
        className="relative w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center"
        style={{
          background: `conic-gradient(${color} ${pct}%, rgba(255,255,255,0.06) 0%)`,
          boxShadow: isLow
            ? "0 0 16px rgba(231,76,60,0.25)"
            : "0 0 16px rgba(240,165,0,0.2)",
        }}
      >
        {/* Inner circle */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--color-surface-1)" }}
        >
          <span
            className="text-xs font-bold tabular-nums leading-tight text-center"
            style={{ color, fontSize: "0.65rem" }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </div>

      {/* Numeric */}
      <div className="space-y-0.5">
        <p className="text-xs text-gray-500">Credits remaining</p>
        <p className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}>
          {remaining}
          <span className="text-gray-600 font-normal text-sm"> / {max}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Payment["status"] }) {
  if (status === "success") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: "rgba(0,210,255,0.1)", color: "var(--color-teal)", border: "1px solid rgba(0,210,255,0.18)" }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Success
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: "rgba(231,76,60,0.1)", color: "var(--color-coral)", border: "1px solid rgba(231,76,60,0.18)" }}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Failed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: "rgba(240,165,0,0.1)", color: "var(--color-amber)", border: "1px solid rgba(240,165,0,0.18)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
      Pending
    </span>
  );
}

// ─── Plan Status Card ─────────────────────────────────────────────────────────

interface PlanCardProps {
  status: BillingStatus;
  onCancel: () => void;
  cancelling: boolean;
}

function PlanCard({ status, onCancel, cancelling }: PlanCardProps) {
  const isUnlimited = PLAN_CREDITS[status.plan] === -1;
  const badgeStyle  = PLAN_BADGE_STYLES[status.plan] ?? PLAN_BADGE_STYLES["free"]!;
  const resetIn     = relativeTime(status.credits_reset_at);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "linear-gradient(160deg, rgba(240,165,0,0.04) 0%, var(--color-surface-1) 100%)",
        borderColor: "rgba(240,165,0,0.12)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Top accent line */}
      <div className="h-0.5" style={{ background: "linear-gradient(90deg, var(--color-amber), transparent)" }} />

      <div className="p-6 space-y-6">
        {/* Plan badge + change */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Plan</p>
            <span
              className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold"
              style={badgeStyle}
            >
              {PLAN_LABELS[status.plan] ?? status.plan}
            </span>
          </div>
          <Link
            to="/pricing"
            className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-full transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: "var(--color-amber)",
              color: "var(--color-charcoal)",
              boxShadow: "0 2px 12px rgba(240,165,0,0.3)",
            }}
          >
            Change Plan
          </Link>
        </div>

        {/* Credits */}
        <div>
          {isUnlimited ? (
            <div className="flex items-center gap-3">
              <div
                className="px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2"
                style={{
                  backgroundColor: "rgba(0,210,255,0.1)",
                  color: "var(--color-teal)",
                  border: "1px solid rgba(0,210,255,0.2)",
                }}
              >
                <span className="text-base">∞</span>
                Unlimited credits
              </div>
              <span className="text-xs text-gray-500">No daily limit</span>
            </div>
          ) : (
            <CreditsRing remaining={status.credits_remaining} max={status.credits_max} />
          )}
        </div>

        {/* Reset time */}
        {!isUnlimited && resetIn && (
          <p className="text-xs text-gray-600 flex items-center gap-1.5">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            Credits reset {resetIn}
          </p>
        )}

        {/* Expiry notice */}
        {status.plan_expires_at && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{
              background: "rgba(240,165,0,0.06)",
              border: "1px solid rgba(240,165,0,0.12)",
              color: "#d1a44a",
            }}
          >
            Your{" "}
            <span className="font-semibold">{PLAN_LABELS[status.plan] ?? status.plan}</span>{" "}
            plan remains active until{" "}
            <span className="font-semibold">{formatDate(status.plan_expires_at)}</span>,
            then reverts to Free.
          </div>
        )}

        {/* Cancel */}
        {status.has_subscription && !status.plan_expires_at && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="text-xs font-medium px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{
              backgroundColor: "rgba(231,76,60,0.08)",
              color: "var(--color-coral)",
              border: "1px solid rgba(231,76,60,0.15)",
            }}
          >
            {cancelling ? "Cancelling…" : "Cancel Subscription"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Payment History ──────────────────────────────────────────────────────────

function PaymentHistory({ payments }: { payments: Payment[] }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <h2
          className="text-sm font-bold text-white"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          Payment History
        </h2>
        {payments.length > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#6b7280" }}
          >
            {payments.length} record{payments.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-2xl mb-2">💳</p>
          <p className="text-gray-500 text-sm">No payment history yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Date", "Plan", "Amount", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-xs font-medium uppercase tracking-wider ${i >= 2 ? "text-right" : "text-left"}`}
                    style={{ color: "#4b5563" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                    borderBottom:
                      i < payments.length - 1
                        ? "1px solid rgba(255,255,255,0.04)"
                        : undefined,
                  }}
                >
                  <td className="px-5 py-4 text-gray-400 whitespace-nowrap text-xs">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-5 py-4 text-gray-300 capitalize text-xs">
                    {PLAN_LABELS[p.plan] ?? p.plan}
                  </td>
                  <td className="px-5 py-4 text-right text-white font-semibold whitespace-nowrap text-xs tabular-nums">
                    {formatGHS(p.amount)}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Billing Page ─────────────────────────────────────────────────────────────

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refresh } = useAuth();
  const billing = useBilling();
  const statusApi  = useApi<BillingStatus>();
  const historyApi = useApi<{ payments: Payment[] }>();
  const cancelApi  = useApi<{ cancelled: boolean; plan_expires_at: string }>();

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Read URL params for toast
  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    const error    = searchParams.get("error");

    if (upgraded === "true") {
      setToast({ type: "success", message: "Plan upgraded successfully! Welcome aboard." });
      setSearchParams({}, { replace: true });
    } else if (error === "payment_failed") {
      setToast({
        type: "error",
        message: "Payment could not be verified. Please try again or contact support.",
      });
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStatus = useCallback(async () => {
    const data = await statusApi.call(() => billing.getStatus());
    if (data) setStatus(data);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(async () => {
    const data = await historyApi.call(() => billing.getHistory());
    if (data) setPayments(data.payments);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadStatus();
    void loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel() {
    if (
      !window.confirm(
        "Are you sure you want to cancel? You'll keep access until the end of your billing period."
      )
    ) {
      return;
    }

    const result = await cancelApi.call(() => billing.cancel());
    if (result) {
      setToast({
        type: "success",
        message: "Subscription cancelled. You'll retain access until the billing period ends.",
      });
      await refresh();
      await loadStatus();
    } else if (cancelApi.error) {
      setToast({ type: "error", message: cancelApi.error });
    }
  }

  const cardBase: React.CSSProperties = {
    backgroundColor: "var(--color-surface-1)",
    borderColor: "rgba(255,255,255,0.06)",
  };

  function SkeletonCard() {
    return (
      <div className="rounded-2xl border p-6 animate-pulse space-y-4" style={cardBase}>
        <div className="h-3 rounded-full w-24" style={{ backgroundColor: "var(--color-surface-3)" }} />
        <div className="h-8 rounded-xl w-28" style={{ backgroundColor: "var(--color-surface-3)" }} />
        <div className="h-2 rounded-full w-full" style={{ backgroundColor: "var(--color-surface-3)" }} />
        <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: "var(--color-surface-3)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold text-white"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          Billing
        </h1>
        <p className="mt-1 text-gray-500 text-sm">
          Manage your subscription and payment history.
        </p>
      </div>

      {/* Plan Status */}
      {statusApi.loading && !status ? (
        <SkeletonCard />
      ) : statusApi.error ? (
        <div
          className="rounded-2xl border p-6 text-sm"
          style={{
            backgroundColor: "rgba(231,76,60,0.06)",
            borderColor: "rgba(231,76,60,0.15)",
            color: "var(--color-coral)",
          }}
        >
          Failed to load billing status: {statusApi.error}
        </div>
      ) : status ? (
        <PlanCard
          status={status}
          onCancel={() => void handleCancel()}
          cancelling={cancelApi.loading}
        />
      ) : null}

      {/* Payment History */}
      {historyApi.loading && payments.length === 0 ? (
        <div className="rounded-2xl border p-6 animate-pulse" style={cardBase}>
          <div className="h-4 rounded w-40" style={{ backgroundColor: "var(--color-surface-3)" }} />
        </div>
      ) : (
        <PaymentHistory payments={payments} />
      )}
    </div>
  );
}
