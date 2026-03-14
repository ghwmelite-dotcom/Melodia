import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useBilling } from "../hooks/useBilling";

export default function BillingCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const billing = useBilling();
  const hasRun = useRef(false);

  useEffect(() => {
    // Strict mode guard — only run once
    if (hasRun.current) return;
    hasRun.current = true;

    const reference = searchParams.get("reference") ?? searchParams.get("trxref");

    if (!reference) {
      void navigate("/billing", { replace: true });
      return;
    }

    async function verify() {
      try {
        await billing.verify(reference!);
        // Refresh auth state so user.plan reflects the new plan immediately
        await refresh();
        void navigate("/billing?upgraded=true", { replace: true });
      } catch {
        void navigate("/billing?error=payment_failed", { replace: true });
      }
    }

    void verify();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      {/* Spinner */}
      <div
        className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: "var(--color-amber)", borderTopColor: "transparent" }}
        role="status"
        aria-label="Verifying payment"
      />

      <div className="text-center space-y-2">
        <p className="text-white font-semibold text-lg">Verifying your payment…</p>
        <p className="text-gray-400 text-sm">Please wait, this will only take a moment.</p>
      </div>
    </div>
  );
}
