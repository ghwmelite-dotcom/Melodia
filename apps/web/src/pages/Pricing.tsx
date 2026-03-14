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
  free:    "Free",
  creator: "Creator",
  pro:     "Pro",
};

const PLAN_ORDER = ["free", "creator", "pro"] as const;

// Plan descriptions
const PLAN_DESCRIPTIONS: Record<string, string> = {
  free:    "Get started and explore",
  creator: "For serious creators",
  pro:     "Unlimited creative power",
};

// ─── Check icon ───────────────────────────────────────────────────────────────

function CheckIcon({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span
      className={`inline-flex items-center justify-center ${dim} rounded-full flex-shrink-0`}
      style={{ backgroundColor: "rgba(240,165,0,0.15)", border: "1px solid rgba(240,165,0,0.25)" }}
    >
      <svg
        className={size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-amber)"
        strokeWidth={3}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
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
  const isCurrent    = currentPlan === plan;
  const isPro        = plan === "pro";
  const isCreator    = plan === "creator";
  const isHighlighted = isPro || isCreator;
  const price        = PLAN_PRICES[plan] ?? 0;
  const features     = PLAN_FEATURES[plan] ?? [];
  const name         = PLAN_NAMES[plan] ?? plan;
  const description  = PLAN_DESCRIPTIONS[plan] ?? "";

  const isThisCardLoading = loading && upgradingPlan === plan;

  // Highlighted card is visually elevated
  const cardStyle: React.CSSProperties = isHighlighted
    ? {
        background: "linear-gradient(160deg, rgba(240,165,0,0.08) 0%, rgba(30,30,60,0.6) 100%)",
        borderColor: isCurrent ? "var(--color-teal)" : "rgba(240,165,0,0.45)",
        borderWidth: "1.5px",
        boxShadow: "0 0 40px rgba(240,165,0,0.12), 0 8px 40px rgba(0,0,0,0.5)",
        transform: "scale(1.03)",
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
      }
    : {
        backgroundColor: "var(--color-surface-1)",
        borderColor: isCurrent ? "var(--color-teal)" : "rgba(255,255,255,0.07)",
        borderWidth: "1px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
      };

  return (
    <div
      className="flex flex-col rounded-2xl border p-6 sm:p-8 relative overflow-hidden"
      style={cardStyle}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = isHighlighted ? "scale(1.03) translateY(-4px)" : "translateY(-4px)";
        el.style.boxShadow = isHighlighted
          ? "0 0 50px rgba(240,165,0,0.18), 0 20px 60px rgba(0,0,0,0.6)"
          : "0 12px 40px rgba(0,0,0,0.5)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = isHighlighted ? "scale(1.03)" : "translateY(0)";
        el.style.boxShadow = isHighlighted
          ? "0 0 40px rgba(240,165,0,0.12), 0 8px 40px rgba(0,0,0,0.5)"
          : "0 4px 24px rgba(0,0,0,0.3)";
      }}
    >
      {/* Background glow for highlighted */}
      {isHighlighted && (
        <div
          aria-hidden="true"
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl opacity-20"
          style={{ backgroundColor: "var(--color-amber)" }}
        />
      )}

      {/* Current plan badge */}
      {isCurrent && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider z-10"
          style={{ backgroundColor: "var(--color-teal)", color: "var(--color-charcoal)" }}
        >
          Your Plan
        </div>
      )}

      {/* Popular badge for highlighted plan */}
      {isHighlighted && !isCurrent && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider z-10 flex items-center gap-1"
          style={{ backgroundColor: "var(--color-amber)", color: "var(--color-charcoal)" }}
        >
          <span>⭐</span>
          Most Popular
        </div>
      )}

      {/* Plan name + description */}
      <div className="mb-5 relative z-10">
        <h3
          className="text-lg font-bold text-white mb-1"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          {name}
        </h3>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      {/* Price display */}
      <div className="mb-6 relative z-10">
        {price === 0 ? (
          <div className="flex items-baseline gap-1">
            <span
              className="text-4xl font-bold text-white"
              style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
            >
              Free
            </span>
            <span className="text-gray-500 text-sm ml-1">forever</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span
              className="text-xl font-bold"
              style={{ color: "var(--color-amber)" }}
            >
              ₵
            </span>
            <span
              className="text-4xl font-bold text-white"
              style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
            >
              {(price / 100).toFixed(0)}
            </span>
            <span className="text-gray-500 text-sm">/month</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        className="mb-5"
        style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)" }}
      />

      {/* Feature list */}
      <ul className="flex-1 space-y-2.5 mb-7 relative z-10">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-300">
            <CheckIcon />
            <span className="leading-snug">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="relative z-10">
        {plan === "free" ? (
          <div
            className="w-full py-3 rounded-xl text-sm font-semibold text-center"
            style={{
              backgroundColor: isCurrent ? "rgba(0,210,255,0.08)" : "rgba(255,255,255,0.04)",
              color: isCurrent ? "var(--color-teal)" : "#6b7280",
              border: `1px solid ${isCurrent ? "rgba(0,210,255,0.2)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            {isCurrent ? "Current Plan" : "Free Forever"}
          </div>
        ) : isCurrent ? (
          <div
            className="w-full py-3 rounded-xl text-sm font-semibold text-center"
            style={{
              backgroundColor: "rgba(0,210,255,0.08)",
              color: "var(--color-teal)",
              border: "1px solid rgba(0,210,255,0.2)",
            }}
          >
            Active Plan
          </div>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={
              isHighlighted
                ? {
                    backgroundColor: "var(--color-amber)",
                    color: "var(--color-charcoal)",
                    boxShadow: "0 4px 20px rgba(240,165,0,0.4)",
                  }
                : {
                    backgroundColor: "var(--color-surface-2)",
                    color: "var(--color-amber)",
                    border: "1px solid rgba(240,165,0,0.2)",
                  }
            }
          >
            {isThisCardLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                Redirecting…
              </span>
            ) : (
              `Upgrade to ${name}`
            )}
          </button>
        )}
      </div>
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
    <div className="max-w-5xl mx-auto space-y-14 pb-12">
      {/* Hero */}
      <div className="text-center space-y-4 pt-6 relative">
        {/* Background gradient mesh */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -top-12 pointer-events-none overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-48 rounded-full blur-3xl opacity-20"
            style={{ background: "radial-gradient(circle, rgba(240,165,0,0.6) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 space-y-4">
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--color-amber)" }}
          >
            Plans & Pricing
          </p>
          <h1
            className="text-4xl sm:text-5xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
          >
            Simple, Transparent Pricing
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto text-base">
            Start free. Upgrade when you&apos;re ready to create more.
            <br />
            <span className="text-gray-500 text-sm">All plans billed in Ghana Cedis (GHS).</span>
          </p>
        </div>
      </div>

      {/* Error banner */}
      {(upgradeError ?? upgradeApi.error) && (
        <div
          className="max-w-xl mx-auto px-5 py-3.5 rounded-xl text-sm text-center"
          style={{
            backgroundColor: "rgba(231,76,60,0.1)",
            color: "var(--color-coral)",
            border: "1px solid rgba(231,76,60,0.2)",
          }}
        >
          {upgradeError ?? upgradeApi.error}
        </div>
      )}

      {/* Plan cards — middle card elevated */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 items-center">
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

      {/* All plans include */}
      <div
        className="rounded-2xl border p-6 sm:p-8"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <h3
          className="text-base font-bold text-white mb-5"
          style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
        >
          All plans include
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            "AI-powered music generation",
            "Instant preview playback",
            "Song library & history",
            "Public profile page",
            "Community Explore feed",
            "Like & share songs",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-gray-400">
              <CheckIcon size="sm" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Enterprise banner — full width */}
      <div
        className="rounded-2xl border overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, rgba(0,210,255,0.06) 0%, rgba(30,30,60,0.8) 100%)",
          borderColor: "rgba(0,210,255,0.15)",
        }}
      >
        {/* Decorative orb */}
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: "var(--color-teal)" }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 p-8 sm:p-10">
          <div className="space-y-2 text-center sm:text-left">
            <h2
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Outfit', 'Sora', sans-serif" }}
            >
              Need more? Let&apos;s talk.
            </h2>
            <p className="text-gray-400 text-sm max-w-md">
              Enterprise plans include dedicated GPU, custom model fine-tuning,
              white-label options, and SLA guarantees. Ideal for studios, labels, and agencies.
            </p>
          </div>

          <a
            href="mailto:enterprise@melodia.app"
            className="flex-shrink-0 inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: "rgba(0,210,255,0.12)",
              color: "var(--color-teal)",
              border: "1.5px solid rgba(0,210,255,0.3)",
              boxShadow: "0 4px 20px rgba(0,210,255,0.15)",
            }}
          >
            Contact Enterprise
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
