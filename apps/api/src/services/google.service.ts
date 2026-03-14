import type { Env } from "../types.js";
import { AppError } from "../middleware/error-handler.js";

export type GoogleUser = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
};

type GoogleTokenResponse = {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const SCOPES = "openid email profile";

// --- Build OAuth Consent URL ---

export function buildGoogleAuthUrl(
  env: Env,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// --- Exchange Authorization Code for Tokens ---

export async function exchangeGoogleCode(
  env: Env,
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("Google token exchange error:", response.status, text);
    throw new AppError(
      "UNAUTHORIZED",
      "Failed to exchange authorization code with Google.",
      401
    );
  }

  return response.json<GoogleTokenResponse>();
}

// --- Fetch Google User Info ---

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("Google userinfo error:", response.status, text);
    throw new AppError(
      "UNAUTHORIZED",
      "Failed to fetch user information from Google.",
      401
    );
  }

  return response.json<GoogleUser>();
}

// --- Derive redirect URI from request origin ---

export function getGoogleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}
