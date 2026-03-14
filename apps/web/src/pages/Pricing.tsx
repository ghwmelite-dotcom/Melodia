import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useBilling } from "../hooks/useBilling";
import { useApi } from "../hooks/useApi";
import { PLAN_FEATURES, PLAN_PRICES } from "@melodia/shared";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(pesewas: number): string {
  return `₵${(pesewas / 100).toFixed(0)}`;
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  creator: "Creator",
  pro: "Pro",
};

const PLAN_ORDER = ["free", "creator", "pro"] as const;

// ─── Check icon ───────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 flex-shrink-0"
      style={{ color: "var(--color-teal)" }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── Plan Card ───────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: string;
  currentPlan: string | undefined;
  isAuthenticated: boolean;
  onUpgrade: (plan: string) => void;
  loading: boolean;
  upgradingPlan: string | null;
}

function PlanCard({
  plan,
  currentPlan,
  isAuthenticated,
  onUpgrade,
  loading,
  upgradingPlan,
}: PlanCardProps) {
  const isCurrent = currentPlan === plan;
  const isPro = plan === "pro";
  const price = PLAN_PRICES[plan] ?? 0;
  const features = PLAN_FEATURES[plan] ?? [];
  const name = PLAN_NAMES[plan] ?? plan;

  const isThisCardLoading = loading && upgradingPlan === plan;

  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--color-surface-1)",
    borderColor: isCurrent ? "var(--color-teal)" : "var(--color-surface-3)",
    borderWidth: isCurrent ? "2px" : "1px",
    boxShadow: isPro
      ? "0 0 32px rgba(240, 165, 0, 0.08), 0 4px 24px rgba(0, 0, 0, 0.4)"
      : "0 4px 16px rgba(0, 0, 0, 0.25)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  };

  return (
    <div
      className="flex flex-col rounded-2xl border p-6 sm:p-8 relative"
      style={cardStyle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = isPro
          ? "0 0 40px rgba(240, 165, 0, 0.12), 0 12px 40px rgba(0, 0, 0, 0.5)"
          : "0 8px 32px rgba(0, 0, 0, 0.4)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = isPro
          ? "0 0 32px rgba(240, 165, 0, 0.08), 0 4px 24px rgba(0, 0, 0, 0.4)"
          : "0 4px 16px rgba(0, 0, 0, 0.25)";
      }}
    >
      {/* Current plan badge */}
      {isCurrent && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
          style={{
            backgroundColor: "var(--color-teal)",
            color: "var(--color-charcoal)",
          }}
        >
          Current Plan
        </div>
      )}

      {/* Popular badge for Pro */}
      {isPro && !isCurrent && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
          style={{
            backgroundColor: "var(--color-amber)",
            color: "var(--color-charcoal)",
          }}
        >
          Most Popular
        </div>
      )}

      {/* Plan name */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">{name}</h3>
        <div className="flex items-baseline gap-1">
          {price === 0 ? (
            <span className="text-3xl font-bold text-white">Free</span>
          ) : (
            <>
              <span className="text-3xl font-bold text-white">{formatPrice(price)}</span>
              <span className="text-gray-400 text-sm">/month</span>
            </>
          )}
        </div>
      </div>

      {/* Feature list */}
      <ul className="flex-1 space-y-3 mb-8">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-gray-300">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      {plan === "free" ? (
        <div
          className="w-full py-3 rounded-xl text-sm font-semibold text-center"
          style={{
            backgroundColor: isCurrent
              ? "rgba(0, 210, 255, 0.1)"
              : "var(--color-surface-2)",
            color: isCurrent ? "var(--color-teal)" : "#9ca3af",
            border: `1px solid ${isCurrent ? "rgba(0, 210, 255, 0.3)" : "var(--color-surface-3)"}`,
          }}
        >
          {isCurrent ? "Your Current Plan" : "Free Forever"}
        </div>
      ) : isCurrent ? (
        <div
          className="w-full py-3 rounded-xl text-sm font-semibold text-center"
          style={{
            backgroundColor: "rgba(0, 210, 255, 0.1)",
            color: "var(--color-teal)",
            border: "1px solid rgba(0, 210, 255, 0.3)",
          }}
        >
          Active Plan
        </div>
      ) : (
        <button
          onClick={() => onUpgrade(plan)}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style={{
            backgroundColor: "var(--color-amber)",
            color: "var(--color-charcoal)",
          }}
        >
          {isThisCardLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-charcoal border-t-transparent rounded-full animate-spin inline-block" />
              Redirecting…
            </span>
          ) : (
            `Upgrade to ${name}`
          )}
        </button>
      )}
    </div>
  );
}

// ─── Pricing Page ─────────────────────────────────────────────────────────────

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const billing = useBilling();
  const upgradeApi = useApi<{ checkout_url: string; reference: string }>();
  const navigate = useNavigate();
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  async function handleUpgrade(plan: string) {
    setUpgradeError(null);

    if (!isAuthenticated) {
      void navigate("/register");
      return;
    }

    setUpgradingPlan(plan);
    const result = await upgradeApi.call(() => billing.subscribe(plan));
    setUpgradingPlan(null);

    if (result) {
      window.location.href = result.checkout_url;
    } else if (upgradeApi.error) {
      setUpgradeError(upgradeApi.error);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4 pt-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-white">
          Simple, Transparent Pricing
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Start free. Upgrade when you're ready to create more.
          All plans billed in Ghana Cedis (GHS).
        </p>
      </div>

      {/* Error banner */}
      {(upgradeError ?? upgradeApi.error) && (
        <div
          className="max-w-xl mx-auto px-4 py-3 rounded-xl text-sm text-center"
          style={{
            backgroundColor: "rgba(231, 76, 60, 0.1)",
            color: "var(--color-coral)",
            border: "1px solid rgba(231, 76, 60, 0.2)",
          }}
        >
          {upgradeError ?? upgradeApi.error}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8">
        {PLAN_ORDER.map((plan) => (
          <PlanCard
            key={plan}
            plan={plan}
            currentPlan={user?.plan}
            isAuthenticated={isAuthenticated}
            onUpgrade={(p) => void handleUpgrade(p)}
            loading={upgradeApi.loading}
            upgradingPlan={upgradingPlan}
          />
        ))}
      </div>

      {/* Feature comparison note */}
      <div
        className="rounded-2xl border p-6 text-sm text-gray-400 space-y-2"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <p className="text-white font-semibold text-base">All plans include:</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {[
            "AI-powered music generation",
            "Instant preview playback",
            "Song library & history",
            "Public profile page",
            "Community Explore feed",
            "Like & share songs",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CheckIcon />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Enterprise section */}
      <div
        className="rounded-2xl border p-8 text-center space-y-4"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <h2 className="text-2xl font-bold text-white">Need more?</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          Enterprise plans include dedicated GPU, custom model fine-tuning, white-label
          options, and SLA guarantees. Ideal for studios, labels, and agencies.
        </p>
        <a
          href="mailto:enterprise@melodia.app"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{
            backgroundColor: "var(--color-surface-2)",
            color: "var(--color-teal)",
            border: "1px solid rgba(0, 210, 255, 0.25)",
          }}
        >
          Contact us
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
