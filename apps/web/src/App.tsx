import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import AuthGuard from "./components/AuthGuard";
import Layout from "./components/Layout";

// Public pages — eager-loaded for fast initial paint
import Landing from "./pages/Landing";

// Auth pages — code-split
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const VerifyOtp = lazy(() => import("./pages/VerifyOtp"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Protected pages — code-split
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Studio = lazy(() => import("./pages/Studio"));
const SongView = lazy(() => import("./pages/SongView"));
const Library = lazy(() => import("./pages/Library"));

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal">
      <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/studio" element={<Studio />} />
            <Route path="/studio/song/:id" element={<SongView />} />
            <Route path="/library" element={<Library />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
