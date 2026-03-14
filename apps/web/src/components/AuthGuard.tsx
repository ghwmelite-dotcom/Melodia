import { Navigate, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";

export default function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading Melodia…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
