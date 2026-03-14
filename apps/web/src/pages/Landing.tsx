import { Link } from "react-router";

/* ── Waveform decoration ────────────────────────────── */
function Waveform({ bars = 28, className = "" }: { bars?: number; className?: string }) {
  const heights = [30, 55, 70, 45, 80, 60, 90, 40, 70, 55, 85, 35, 65, 50,
    90, 45, 75, 60, 40, 80, 55, 70, 35, 65, 50, 85, 40, 70];
  return (
    <div className={`waveform ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            height: `${heights[i % heights.length]}%`,
            animationDelay: `${(i * 0.09).toFixed(2)}s`,
            opacity: 0.6 + (i % 3) * 0.13,
          }}
        />
      ))}
    </div>
  );
}

/* ── Music note particles ───────────────────────────── */
const NOTES = ["♩", "♪", "♫", "♬", "𝄞"];
const NOTE_POSITIONS = [
  { top: "12%",  left: "8%",   delay: 0,    dur: 6.5, size: "text-2xl" },
  { top: "20%",  left: "88%",  delay: 1.2,  dur: 7,   size: "text-xl" },
  { top: "72%",  left: "5%",   delay: 2.4,  dur: 8,   size: "text-3xl" },
  { top: "60%",  left: "92%",  delay: 0.8,  dur: 6,   size: "text-lg" },
  { top: "40%",  left: "94%",  delay: 3,    dur: 9,   size: "text-2xl" },
  { top: "85%",  left: "15%",  delay: 1.6,  dur: 7.5, size: "text-xl" },
  { top: "30%",  left: "3%",   delay: 4,    dur: 6,   size: "text-lg" },
  { top: "78%",  left: "82%",  delay: 2,    dur: 8.5, size: "text-2xl" },
];

function MusicNoteParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {NOTE_POSITIONS.map((pos, i) => (
        <span
          key={i}
          className={`absolute ${pos.size} select-none`}
          style={{
            top: pos.top,
            left: pos.left,
            color: i % 2 === 0 ? "rgba(240,165,0,0.18)" : "rgba(255,209,102,0.12)",
            animation: `floatUp ${pos.dur}s ease-in-out ${pos.delay}s infinite`,
            willChange: "transform",
          }}
        >
          {NOTES[i % NOTES.length]}
        </span>
      ))}
    </div>
  );
}

/* ── Ambient mesh orbs ──────────────────────────────── */
function MeshBackground() {
  return (
    <div className="mesh-bg" aria-hidden="true">
      {/* Deep base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,22,60,0.9) 0%, transparent 70%)",
        }}
      />
      {/* Amber orb — top left */}
      <div
        className="mesh-orb"
        style={{
          width: 560,
          height: 560,
          top: "-120px",
          left: "-80px",
          background: "radial-gradient(circle, rgba(240,165,0,0.18) 0%, transparent 70%)",
          animation: "orb-drift-1 18s ease-in-out infinite",
        }}
      />
      {/* Midnight orb — bottom right */}
      <div
        className="mesh-orb"
        style={{
          width: 700,
          height: 700,
          bottom: "-200px",
          right: "-150px",
          background: "radial-gradient(circle, rgba(18,18,80,0.7) 0%, transparent 65%)",
          animation: "orb-drift-2 22s ease-in-out infinite",
        }}
      />
      {/* Accent orb — center */}
      <div
        className="mesh-orb"
        style={{
          width: 400,
          height: 400,
          top: "35%",
          left: "45%",
          background: "radial-gradient(circle, rgba(240,165,0,0.07) 0%, transparent 70%)",
          animation: "orb-drift-3 14s ease-in-out infinite",
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(240,165,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(240,165,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

/* ── Feature cards ──────────────────────────────────── */
const FEATURES = [
  {
    icon: "✍️",
    step: "01",
    title: "Describe",
    desc: "Type your vision — mood, genre, tempo, instruments. Use natural language. Afrobeat, highlife, amapiano — anything.",
    color: "rgba(240,165,0,0.12)",
    border: "rgba(240,165,0,0.2)",
  },
  {
    icon: "⚡",
    step: "02",
    title: "Generate",
    desc: "Our AI composes, arranges and produces a full track in seconds. Every generation is unique to your prompt.",
    color: "rgba(0,210,255,0.08)",
    border: "rgba(0,210,255,0.15)",
  },
  {
    icon: "🎧",
    step: "03",
    title: "Listen",
    desc: "Stream your track instantly. Regenerate variations, tweak the prompt, iterate until it sounds exactly right.",
    color: "rgba(255,100,150,0.08)",
    border: "rgba(255,100,150,0.15)",
  },
  {
    icon: "🚀",
    step: "04",
    title: "Share",
    desc: "Download your track in high quality or share directly to your audience. The beat is yours — royalty-free.",
    color: "rgba(100,255,180,0.08)",
    border: "rgba(100,255,180,0.15)",
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[0];
  index: number;
}) {
  return (
    <div
      className="relative rounded-2xl p-6 group transition-all duration-300 anim-fadeup"
      style={{
        background: `linear-gradient(145deg, ${feature.color}, rgba(22,22,46,0.6))`,
        border: `1px solid ${feature.border}`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        animationDelay: `${0.5 + index * 0.12}s`,
      }}
    >
      {/* Step number — subtle watermark */}
      <span
        className="absolute top-4 right-5 text-5xl font-black leading-none select-none"
        style={{
          fontFamily: "var(--font-display)",
          color: "rgba(255,255,255,0.04)",
        }}
        aria-hidden="true"
      >
        {feature.step}
      </span>

      <div className="text-3xl mb-4" aria-hidden="true">
        {feature.icon}
      </div>
      <h3
        className="text-lg font-bold mb-2 text-white"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {feature.title}
      </h3>
      <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>

      {/* Hover glow line */}
      <div
        className="absolute bottom-0 left-6 right-6 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${feature.border}, transparent)`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

/* ── Genre tags ─────────────────────────────────────── */
const GENRES = [
  "Afrobeats", "Amapiano", "Highlife", "Afro-Pop", "Bongo Flava",
  "Afro-House", "Jùjú", "Kuduro", "Genge", "Bikutsi",
  "Coupé-Décalé", "Fuji", "Afro-Soul", "Benga", "Ndombolo",
];

function GenreTags() {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto" role="list" aria-label="Supported music genres">
      {GENRES.map((genre, i) => (
        <span
          key={genre}
          role="listitem"
          className="px-3 py-1.5 rounded-full text-xs font-medium anim-fadeup"
          style={{
            background: "rgba(240,165,0,0.08)",
            border: "1px solid rgba(240,165,0,0.18)",
            color: "#FFD166",
            fontFamily: "var(--font-body)",
            animationDelay: `${0.8 + i * 0.04}s`,
          }}
        >
          {genre}
        </span>
      ))}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────── */
export default function Landing() {
  return (
    <div
      className="min-h-screen flex flex-col relative overflow-x-hidden"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      {/* ── Navigation ── */}
      <nav
        className="relative z-20 border-b"
        style={{ borderColor: "rgba(45, 45, 88, 0.4)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "rgba(15,15,26,0.7)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #F0A500 0%, #D4920A 100%)",
                  boxShadow: "0 2px 12px rgba(240,165,0,0.35)",
                }}
                aria-hidden="true"
              >
                <span className="text-sm font-black text-black" style={{ fontFamily: "var(--font-display)" }}>M</span>
              </div>
              <span
                className="text-xl font-bold tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  background: "linear-gradient(135deg, #F0A500 0%, #FFD166 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Melodia
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:text-white text-slate-400"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn-primary px-5 py-2 rounded-lg text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex-1 flex items-center justify-center px-4 pt-16 pb-24 overflow-hidden">
        <MeshBackground />
        <MusicNoteParticles />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Live badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 anim-fadeup"
            style={{
              background: "rgba(240,165,0,0.1)",
              border: "1px solid rgba(240,165,0,0.28)",
              color: "#FFD166",
              fontFamily: "var(--font-display)",
              animationDelay: "0s",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#F0A500" }}
              aria-hidden="true"
            />
            AI-Powered · Made for Africa
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.05] mb-6 anim-fadeup"
            style={{
              fontFamily: "var(--font-display)",
              color: "#f1f5f9",
              animationDelay: "0.1s",
            }}
          >
            Your Sound.{" "}
            <br className="hidden sm:block" />
            <span className="text-gradient-amber">No Limits.</span>
          </h1>

          {/* Sub-headline */}
          <p
            className="text-lg sm:text-xl text-slate-400 mb-4 max-w-2xl mx-auto leading-relaxed anim-fadeup"
            style={{ animationDelay: "0.2s" }}
          >
            Turn a single sentence into a full track in seconds. Afrobeats, Amapiano,
            Highlife — every genre rooted in Africa, powered by AI.
          </p>

          {/* Waveform accent */}
          <div
            className="flex justify-center mb-10 anim-fadeup"
            style={{ height: 48, animationDelay: "0.28s" }}
          >
            <Waveform bars={36} />
          </div>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 anim-fadeup"
            style={{ animationDelay: "0.35s" }}
          >
            <Link
              to="/register"
              className="btn-primary w-full sm:w-auto px-8 py-4 rounded-xl text-base"
            >
              Start Creating — Free
            </Link>
            <Link
              to="/login"
              className="btn-ghost w-full sm:w-auto px-8 py-4 rounded-xl text-base"
            >
              Sign in to your account
            </Link>
          </div>

          {/* Trust line */}
          <p
            className="mt-6 text-xs text-slate-600 anim-fadeup"
            style={{ animationDelay: "0.45s" }}
          >
            Free to start · No credit card required · Yours to keep
          </p>
        </div>
      </section>

      {/* ── Social proof ── */}
      <section
        className="relative py-16 px-4 border-y"
        style={{
          borderColor: "rgba(45,45,88,0.4)",
          background: "linear-gradient(180deg, rgba(22,22,46,0.4) 0%, rgba(15,15,26,0.6) 100%)",
        }}
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-8 mb-12">
            {[
              { value: "1,000+", label: "Creators", suffix: "" },
              { value: "12k+",   label: "Tracks Made", suffix: "" },
              { value: "15+",    label: "African Genres", suffix: "" },
            ].map((stat, i) => (
              <div key={stat.label} className="anim-fadeup" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
                <div
                  className="text-3xl sm:text-4xl font-black mb-1"
                  style={{
                    fontFamily: "var(--font-display)",
                    background: "linear-gradient(135deg, #F0A500 0%, #FFD166 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {stat.value}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Genre tags */}
          <p
            className="text-sm font-semibold uppercase tracking-widest mb-5 anim-fadeup"
            style={{
              color: "rgba(240,165,0,0.6)",
              fontFamily: "var(--font-display)",
              animationDelay: "0.75s",
            }}
          >
            Every genre. Every rhythm. Every story.
          </p>
          <GenreTags />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative py-20 px-4">
        {/* Section ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(240,165,0,0.04) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span
              className="inline-block text-xs font-bold uppercase tracking-widest mb-4 anim-fadeup"
              style={{
                color: "rgba(240,165,0,0.7)",
                fontFamily: "var(--font-display)",
                animationDelay: "0.1s",
              }}
            >
              The Workflow
            </span>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-black text-white anim-fadeup"
              style={{
                fontFamily: "var(--font-display)",
                animationDelay: "0.18s",
              }}
            >
              From idea to beat in{" "}
              <span className="text-gradient-amber">four steps</span>
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto anim-fadeup" style={{ animationDelay: "0.26s" }}>
              No instruments. No studio time. No experience needed. Just describe, and Melodia handles the rest.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} feature={f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA banner ── */}
      <section className="relative py-20 px-4 overflow-hidden">
        {/* Banner mesh */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 70% 80% at 20% 50%, rgba(240,165,0,0.1) 0%, transparent 60%),
              radial-gradient(ellipse 50% 60% at 80% 50%, rgba(18,18,80,0.6) 0%, transparent 70%)
            `,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(240,165,0,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(240,165,0,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 anim-fadescale"
            style={{
              background: "linear-gradient(135deg, rgba(240,165,0,0.2), rgba(240,165,0,0.05))",
              border: "1px solid rgba(240,165,0,0.25)",
              animationDelay: "0.1s",
            }}
            aria-hidden="true"
          >
            <span className="text-3xl">🎵</span>
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 anim-fadeup"
            style={{ fontFamily: "var(--font-display)", animationDelay: "0.2s" }}
          >
            Ready to make your{" "}
            <span className="text-gradient-amber">first track?</span>
          </h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto anim-fadeup" style={{ animationDelay: "0.3s" }}>
            Join thousands of African creators building their sound with AI. It's free to start.
          </p>
          <Link
            to="/register"
            className="btn-primary inline-block px-10 py-4 rounded-xl text-base anim-fadeup"
            style={{ animationDelay: "0.4s" }}
          >
            Create Your Free Account →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="border-t py-8 px-4 text-center"
        style={{ borderColor: "rgba(45,45,88,0.35)" }}
      >
        <p className="text-xs text-slate-700">
          © {new Date().getFullYear()} Melodia · Built for African creators ·{" "}
          <Link to="/login" className="hover:text-amber-500 transition-colors" style={{ color: "rgba(240,165,0,0.4)" }}>
            Sign In
          </Link>
        </p>
      </footer>
    </div>
  );
}
