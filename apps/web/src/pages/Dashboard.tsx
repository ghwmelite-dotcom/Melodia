import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();

  const planColors: Record<string, { bg: string; text: string; border: string }> = {
    free: {
      bg: "rgba(45, 45, 80, 0.5)",
      text: "#9ca3af",
      border: "var(--color-surface-3)",
    },
    pro: {
      bg: "rgba(240, 165, 0, 0.12)",
      text: "var(--color-amber)",
      border: "rgba(240, 165, 0, 0.3)",
    },
    enterprise: {
      bg: "rgba(0, 210, 255, 0.1)",
      text: "var(--color-teal)",
      border: "rgba(0, 210, 255, 0.3)",
    },
  };

  const planStyle = planColors[user?.plan ?? "free"] ?? planColors["free"];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back,{" "}
          <span style={{ color: "var(--color-amber)" }}>
            {user?.display_name ?? user?.username ?? "Musician"}
          </span>
        </h1>
        <p className="mt-1 text-gray-400">
          Your AI music studio — let's create something.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Credits card */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Credits Remaining
          </p>
          <p
            className="text-4xl font-bold"
            style={{ color: "var(--color-amber)" }}
          >
            {user?.credits_remaining ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">AI generation credits</p>
        </div>

        {/* Plan card */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Current Plan
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold capitalize"
              style={{
                backgroundColor: planStyle.bg,
                color: planStyle.text,
                border: `1px solid ${planStyle.border}`,
              }}
            >
              {user?.plan ?? "free"}
            </span>
          </div>
        </div>

        {/* Member since */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-surface-3)",
          }}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Member Since
          </p>
          <p className="text-lg font-semibold text-white">
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>

      {/* Song studio coming soon card */}
      <div
        className="rounded-2xl p-8 border text-center relative overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        {/* Background gradient accent */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, var(--color-amber) 0%, transparent 70%)",
          }}
        />

        {/* Music note icon */}
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
          style={{ backgroundColor: "rgba(240, 165, 0, 0.12)" }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-amber)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Song Studio</h2>
        <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
          The full AI music generation studio is coming in Sub-project 3. You'll be able to
          generate, edit, and export tracks — all from your browser.
        </p>
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: "rgba(240, 165, 0, 0.1)",
            color: "var(--color-amber)",
            border: "1px solid rgba(240, 165, 0, 0.2)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--color-amber)" }}
          />
          Coming in Sub-project 3
        </div>
      </div>
    </div>
  );
}
