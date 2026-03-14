import { Link } from "react-router";

export default function Landing() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "rgba(45, 45, 80, 0.5)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--color-amber)" }}
            >
              Melodia
            </span>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95"
                style={{ backgroundColor: "var(--color-amber)" }}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
            style={{
              backgroundColor: "rgba(240, 165, 0, 0.12)",
              color: "var(--color-amber)",
              border: "1px solid rgba(240, 165, 0, 0.25)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--color-amber)" }}
            />
            Powered by AI
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-white">
            Create Music{" "}
            <span
              className="relative inline-block"
              style={{
                color: "var(--color-amber)",
                WebkitTextFillColor: "transparent",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                backgroundImage: "linear-gradient(135deg, #F0A500 0%, #FFD166 100%)",
              }}
            >
              with AI
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Turn your ideas into full tracks in seconds. No instruments, no studio —
            just your imagination and Melodia's AI.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-black transition-all hover:opacity-90 active:scale-95 shadow-lg"
              style={{
                backgroundColor: "var(--color-amber)",
                boxShadow: "0 8px 32px rgba(240, 165, 0, 0.35)",
              }}
            >
              Start Creating — Free
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-medium text-gray-300 hover:text-white transition-colors border"
              style={{
                borderColor: "var(--color-surface-3)",
                backgroundColor: "var(--color-surface-1)",
              }}
            >
              Sign in to your account
            </Link>
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-gray-600">
            Free to start · No credit card required
          </p>
        </div>
      </main>
    </div>
  );
}
