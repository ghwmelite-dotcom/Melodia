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
  free: "Free",
  creator: "Creator",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_BADGE_STYLES: Record<string, React.CSSProperties> = {
  free: {
    backgroundColor: "rgba(45, 45, 80, 0.5)",
    color: "#9ca3af",
    border: "1px solid var(--color-surface-3)",
  },
  creator: {
    backgroundColor: "rgba(240, 165, 0, 0.12)",
    color: "var(--color-amber)",
    border: "1px solid rgba(240, 165, 0, 0.3)",
  },
  pro: {
    backgroundColor: "rgba(0, 210, 255, 0.1)",
    color: "var(--color-teal)",
    border: "1px solid rgba(0, 210, 255, 0.3)",
  },
  enterprise: {
    backgroundColor: "rgba(0, 210, 255, 0.1)",
    color: "var(--color-teal)",
    border: "1px solid rgba(0, 210, 255, 0.3)",
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
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium shadow-lg max-w-sm w-full"
      style={
        type === "success"
          ? {
              backgroundColor: "rgba(0, 210, 255, 0.15)",
              color: "var(--color-teal)",
              border: "1px solid rgba(0, 210, 255, 0.3)",
            }
          : {
              backgroundColor: "rgba(231, 76, 60, 0.15)",
              color: "var(--color-coral)",
              border: "1px solid rgba(231, 76, 60, 0.3)",
            }
      }
      role="alert"
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="opacity-70 hover:opacity-100 transition-opacity text-lg leading-none cursor-pointer"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

// ─── Credits progress bar ────────────────────────────────────────────────────

function CreditsBar({ remaining, max }: { remaining: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (remaining / max) * 100)) : 0;
  const isLow = pct <= 20;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Credits remaining</span>
        <span className="font-semibold text-white">
          {remaining} / {max}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: isLow ? "var(--color-coral)" : "var(--color-amber)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Payment["status"] }) {
  if (status === "success") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: "rgba(0, 210, 255, 0.12)", color: "var(--color-teal)" }}
      >
        <span>✓</span> Success
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: "rgba(231, 76, 60, 0.12)", color: "var(--color-coral)" }}
      >
        <span>✗</span> Failed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: "rgba(240, 165, 0, 0.12)", color: "var(--color-amber)" }}
    >
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
  const badgeStyle = PLAN_BADGE_STYLES[status.plan] ?? PLAN_BADGE_STYLES["free"];
  const resetIn = relativeTime(status.credits_reset_at);

  return (
    <div
      className="rounded-2xl border p-6 space-y-5"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "var(--color-surface-3)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400 mb-2">Current plan</p>
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
            style={badgeStyle}
          >
            {PLAN_LABELS[status.plan] ?? status.plan}
          </span>
        </div>
        <Link
          to="/pricing"
          className="text-sm font-medium px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
          style={{
            backgroundColor: "var(--color-amber)",
            color: "var(--color-charcoal)",
          }}
        >
          Change Plan
        </Link>
      </div>

      {/* Credits */}
      <div>
        {isUnlimited ? (
          <div className="flex items-center gap-2 text-sm">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: "rgba(0, 210, 255, 0.1)", color: "var(--color-teal)" }}
            >
              ∞ Unlimited
            </span>
            <span className="text-gray-400">songs — no daily limit</span>
          </div>
        ) : (
          <CreditsBar remaining={status.credits_remaining} max={status.credits_max} />
        )}
      </div>

      {/* Reset time */}
      {!isUnlimited && resetIn && (
        <p className="text-xs text-gray-500">Credits reset {resetIn}</p>
      )}

      {/* Expiry notice */}
      {status.plan_expires_at && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            backgroundColor: "rgba(240, 165, 0, 0.06)",
            border: "1px solid rgba(240, 165, 0, 0.15)",
            color: "#d1a44a",
          }}
        >
          Your{" "}
          <span className="font-semibold">{PLAN_LABELS[status.plan] ?? status.plan}</span>{" "}
          plan will remain active until{" "}
          <span className="font-semibold">{formatDate(status.plan_expires_at)}</span>,
          then revert to Free.
        </div>
      )}

      {/* Cancel */}
      {status.has_subscription && !status.plan_expires_at && (
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="text-sm font-medium px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style={{
            backgroundColor: "rgba(231, 76, 60, 0.1)",
            color: "var(--color-coral)",
            border: "1px solid rgba(231, 76, 60, 0.2)",
          }}
        >
          {cancelling ? "Cancelling…" : "Cancel Subscription"}
        </button>
      )}
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
        borderColor: "var(--color-surface-3)",
      }}
    >
      <div className="px-6 py-4 border-b" style={{ borderColor: "var(--color-surface-3)" }}>
        <h2 className="text-base font-semibold text-white">Payment History</h2>
      </div>

      {payments.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-500 text-sm">
          No payment history yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-surface-3)" }}>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom:
                      i < payments.length - 1
                        ? "1px solid var(--color-surface-3)"
                        : undefined,
                  }}
                >
                  <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-300 capitalize">
                    {PLAN_LABELS[p.plan] ?? p.plan}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-200 font-medium whitespace-nowrap">
                    {formatGHS(p.amount)}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
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
  const statusApi = useApi<BillingStatus>();
  const historyApi = useApi<{ payments: Payment[] }>();
  const cancelApi = useApi<{ cancelled: boolean; plan_expires_at: string }>();

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Read URL params for toast
  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    const error = searchParams.get("error");

    if (upgraded === "true") {
      setToast({ type: "success", message: "Plan upgraded successfully! Welcome aboard." });
      // Clean up URL params
      setSearchParams({}, { replace: true });
    } else if (error === "payment_failed") {
      setToast({ type: "error", message: "Payment could not be verified. Please try again or contact support." });
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
        "Are you sure you want to cancel your subscription? You'll keep access until the end of your billing period."
      )
    ) {
      return;
    }

    const result = await cancelApi.call(() => billing.cancel());
    if (result) {
      setToast({ type: "success", message: "Subscription cancelled. You'll retain access until the billing period ends." });
      await refresh();
      await loadStatus();
    } else if (cancelApi.error) {
      setToast({ type: "error", message: cancelApi.error });
    }
  }

  const cardBase: React.CSSProperties = {
    backgroundColor: "var(--color-surface-1)",
    borderColor: "var(--color-surface-3)",
  };

  function SkeletonCard() {
    return (
      <div className="rounded-2xl border p-6 animate-pulse" style={cardBase}>
        <div className="h-4 bg-surface-3 rounded w-24 mb-4" style={{ backgroundColor: "var(--color-surface-3)" }} />
        <div className="h-8 bg-surface-3 rounded w-20 mb-6" style={{ backgroundColor: "var(--color-surface-3)" }} />
        <div className="h-2 bg-surface-3 rounded w-full" style={{ backgroundColor: "var(--color-surface-3)" }} />
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

      <div>
        <h1 className="text-3xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-gray-400 text-sm">Manage your subscription and payment history.</p>
      </div>

      {/* Plan Status */}
      {statusApi.loading && !status ? (
        <SkeletonCard />
      ) : statusApi.error ? (
        <div
          className="rounded-2xl border p-6 text-sm"
          style={{
            backgroundColor: "rgba(231, 76, 60, 0.08)",
            borderColor: "rgba(231, 76, 60, 0.2)",
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
        <div
          className="rounded-2xl border p-6 animate-pulse"
          style={cardBase}
        >
          <div className="h-4 rounded w-40" style={{ backgroundColor: "var(--color-surface-3)" }} />
        </div>
      ) : (
        <PaymentHistory payments={payments} />
      )}
    </div>
  );
}
