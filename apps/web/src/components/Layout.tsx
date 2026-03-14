import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-charcoal)" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: "rgba(22, 33, 62, 0.85)",
          borderColor: "rgba(45, 45, 80, 0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/dashboard"
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--color-amber)" }}
            >
              Melodia
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              <NavLink
                to="/studio"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { backgroundColor: "var(--color-surface-3)" }
                    : undefined
                }
              >
                Studio
              </NavLink>
              <NavLink
                to="/library"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { backgroundColor: "var(--color-surface-3)" }
                    : undefined
                }
              >
                Library
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { backgroundColor: "var(--color-surface-3)" }
                    : undefined
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { backgroundColor: "var(--color-surface-3)" }
                    : undefined
                }
              >
                Settings
              </NavLink>
            </div>

            {/* User area */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 hidden sm:block">
                {user?.display_name ?? user?.username}
              </span>
              <button
                onClick={() => void logout()}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
                style={{ backgroundColor: "var(--color-surface-2)" }}
              >
                Sign out
              </button>
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
