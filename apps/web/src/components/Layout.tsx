import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";

// ─── Waveform glyph SVG ───────────────────────────────────────────────────────

function WaveformIcon() {
  return (
    <svg
      width="22"
      height="18"
      viewBox="0 0 22 18"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="0" y="6" width="2.5" height="6" rx="1.25" fill="#F0A500" />
      <rect x="3.5" y="3" width="2.5" height="12" rx="1.25" fill="#F0A500" opacity="0.85" />
      <rect x="7" y="0" width="2.5" height="18" rx="1.25" fill="#F0A500" />
      <rect x="10.5" y="4" width="2.5" height="10" rx="1.25" fill="#F0A500" opacity="0.9" />
      <rect x="14" y="2" width="2.5" height="14" rx="1.25" fill="#F0A500" opacity="0.8" />
      <rect x="17.5" y="5" width="2.5" height="8" rx="1.25" fill="#F0A500" opacity="0.7" />
      <rect x="21" y="7" width="1" height="4" rx="0.5" fill="#F0A500" opacity="0.5" />
    </svg>
  );
}

// ─── User avatar ──────────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "M";

  return (
    <div
      title={name}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #F0A500 0%, #FF6B6B 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "13px",
        fontWeight: 700,
        color: "#0D0D1A",
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: "0.02em",
        flexShrink: 0,
        boxShadow: "0 0 0 2px rgba(240,165,0,0.25), 0 2px 8px rgba(240,165,0,0.2)",
        cursor: "default",
        transition: "box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 0 0 2px rgba(240,165,0,0.5), 0 4px 16px rgba(240,165,0,0.35)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 0 0 2px rgba(240,165,0,0.25), 0 2px 8px rgba(240,165,0,0.2)";
      }}
    >
      {initials}
    </div>
  );
}

// ─── Animated nav link ────────────────────────────────────────────────────────

function StyledNavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      style={{ textDecoration: "none", position: "relative", display: "inline-block" }}
    >
      {({ isActive }) => (
        <span
          style={{
            display: "inline-block",
            position: "relative",
            padding: "6px 14px",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily: "'Outfit', 'DM Sans', sans-serif",
            color: isActive ? "#ffffff" : "rgba(156,163,175,1)",
            transition: "color 0.2s",
            letterSpacing: "0.01em",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              (e.currentTarget as HTMLSpanElement).style.color = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              (e.currentTarget as HTMLSpanElement).style.color = "rgba(156,163,175,1)";
            }
          }}
        >
          {children}
          {/* Animated amber underline */}
          <span
            style={{
              position: "absolute",
              bottom: 0,
              left: "14px",
              right: "14px",
              height: "2px",
              background: "linear-gradient(90deg, #F0A500, #FF8C00)",
              borderRadius: "2px",
              transform: isActive ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left center",
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: isActive ? "0 0 8px rgba(240,165,0,0.6)" : "none",
            }}
          />
        </span>
      )}
    </NavLink>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  const displayName = user?.display_name ?? user?.username ?? "";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--color-charcoal)" }}
    >
      {/* Thin top-border amber glow line */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(240,165,0,0.6) 30%, rgba(240,165,0,0.85) 50%, rgba(240,165,0,0.6) 70%, transparent 100%)",
          zIndex: 51,
        }}
      />

      {/* Nav bar */}
      <nav
        className="sticky top-0 z-50"
        style={{
          backgroundColor: "rgba(13, 13, 26, 0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(240,165,0,0.12)",
          boxShadow:
            "0 1px 30px rgba(240,165,0,0.07), 0 4px 24px rgba(0,0,0,0.35)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link
              to={isAuthenticated ? "/dashboard" : "/"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textDecoration: "none",
              }}
            >
              <WaveformIcon />
              <span
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 800,
                  fontSize: "20px",
                  letterSpacing: "-0.02em",
                  background: "linear-gradient(135deg, #F0A500 0%, #FFD060 60%, #F0A500 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  lineHeight: 1,
                }}
              >
                Melodia
              </span>
            </Link>

            {/* Nav links */}
            <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <StyledNavLink to="/explore">Explore</StyledNavLink>
              <StyledNavLink to="/pricing">Pricing</StyledNavLink>

              {isAuthenticated && (
                <>
                  <StyledNavLink to="/studio">Studio</StyledNavLink>
                  <StyledNavLink to="/library">Library</StyledNavLink>
                  <StyledNavLink to="/dashboard">Dashboard</StyledNavLink>
                  <StyledNavLink to="/settings">Settings</StyledNavLink>
                </>
              )}
            </div>

            {/* User area */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {isAuthenticated ? (
                <div ref={menuRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "40px",
                    }}
                    aria-label="User menu"
                  >
                    <UserAvatar name={displayName} />
                    <span
                      className="hidden sm:block"
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "rgba(220,220,240,0.85)",
                        fontFamily: "'Outfit', 'DM Sans', sans-serif",
                        maxWidth: "120px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayName}
                    </span>
                    {/* Chevron */}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="hidden sm:block"
                      style={{
                        color: "rgba(156,163,175,0.7)",
                        transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <path
                        d="M3 5l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {userMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 10px)",
                        right: 0,
                        minWidth: "180px",
                        backgroundColor: "rgba(22, 22, 40, 0.97)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(240,165,0,0.15)",
                        borderRadius: "14px",
                        boxShadow:
                          "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
                        overflow: "hidden",
                        zIndex: 100,
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 16px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#fff",
                            fontFamily: "'Outfit', sans-serif",
                            margin: 0,
                          }}
                        >
                          {displayName}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "rgba(156,163,175,0.8)",
                            margin: "2px 0 0",
                          }}
                        >
                          {user?.plan ?? "free"} plan
                        </p>
                      </div>
                      <div style={{ padding: "6px" }}>
                        <Link
                          to="/settings"
                          style={{
                            display: "block",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: "rgba(200,200,220,0.9)",
                            fontFamily: "'Outfit', 'DM Sans', sans-serif",
                            textDecoration: "none",
                            transition: "background 0.15s, color 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLAnchorElement).style.background =
                              "rgba(240,165,0,0.08)";
                            (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLAnchorElement).style.background = "none";
                            (e.currentTarget as HTMLAnchorElement).style.color =
                              "rgba(200,200,220,0.9)";
                          }}
                        >
                          Settings
                        </Link>
                        <button
                          onClick={() => void logout()}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: "rgba(255,107,107,0.85)",
                            fontFamily: "'Outfit', 'DM Sans', sans-serif",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            transition: "background 0.15s, color 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "rgba(255,107,107,0.1)";
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "rgba(255,107,107,1)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "none";
                            (e.currentTarget as HTMLButtonElement).style.color =
                              "rgba(255,107,107,0.85)";
                          }}
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    style={{
                      padding: "7px 16px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 500,
                      fontFamily: "'Outfit', 'DM Sans', sans-serif",
                      color: "rgba(200,200,220,0.85)",
                      backgroundColor: "var(--color-surface-2)",
                      textDecoration: "none",
                      transition: "color 0.2s, background 0.2s",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color =
                        "rgba(200,200,220,0.85)";
                    }}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    style={{
                      padding: "7px 18px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 700,
                      fontFamily: "'Outfit', sans-serif",
                      background: "linear-gradient(135deg, #F0A500 0%, #FF8C00 100%)",
                      color: "#0D0D1A",
                      textDecoration: "none",
                      letterSpacing: "0.01em",
                      boxShadow: "0 2px 12px rgba(240,165,0,0.35)",
                      transition: "box-shadow 0.2s, transform 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                        "0 4px 20px rgba(240,165,0,0.55)";
                      (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                        "0 2px 12px rgba(240,165,0,0.35)";
                      (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                    }}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>

          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
