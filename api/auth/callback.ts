import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

const APP_URL = process.env.VITE_APP_URL ?? "http://localhost:5173";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const ACCESS_TOKEN_COOKIE = "sb-access-token";
const REFRESH_TOKEN_COOKIE = "sb-refresh-token";
const SESSION_COOKIE = "sb-auth-session";
const EXPIRES_AT_COOKIE = "sb-token-expires-at";

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

const isProduction = (process.env.NODE_ENV ?? "development") === "production";

const serializeCookie = (name: string, value: string, maxAge?: number) => {
  const parts = [`${name}=${value}`, "Path=/", "SameSite=Strict"];
  if (isProduction) {
    parts.push("Secure");
  }
  if (typeof maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  }
  return parts.join("; ");
};

const redirectResponse = (location: string) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: location,
    },
  });

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase environment variables are missing");
    return redirectResponse(`${APP_URL}/auth?error=configuration_error`);
  }

  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const redirectTo = requestUrl.searchParams.get("redirect_to");
  const targetLocation =
    redirectTo && redirectTo.startsWith("http")
      ? redirectTo
      : redirectTo
        ? `${APP_URL.replace(/\/$/, "")}${redirectTo}`
        : APP_URL;

  if (error) {
    console.error("OAuth error:", error, errorDescription);
    return redirectResponse(
      `${APP_URL}/auth?error=${encodeURIComponent(errorDescription ?? error)}`,
    );
  }

  if (!code) {
    console.error("Missing authorization code");
    return redirectResponse(`${APP_URL}/auth?error=missing_code`);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data.session) {
      console.error("Failed to exchange authorization code", exchangeError);
      return redirectResponse(`${APP_URL}/auth?error=exchange_failed`);
    }

    const session = data.session;
    const { access_token, refresh_token, expires_in, expires_at } = session;
    const safeAccessToken = encodeURIComponent(access_token);
    const safeRefreshToken = encodeURIComponent(refresh_token);
    const safeSession = encodeURIComponent(JSON.stringify(session));
    const expiresAtValue = encodeURIComponent(String(expires_at ?? Math.floor(Date.now() / 1000 + expires_in)));

    const headers = new Headers();
    headers.append("Set-Cookie", serializeCookie(ACCESS_TOKEN_COOKIE, safeAccessToken, expires_in));
    headers.append(
      "Set-Cookie",
      serializeCookie(REFRESH_TOKEN_COOKIE, safeRefreshToken, THIRTY_DAYS_IN_SECONDS),
    );
    headers.append("Set-Cookie", serializeCookie(SESSION_COOKIE, safeSession, expires_in));
    headers.append("Set-Cookie", serializeCookie(EXPIRES_AT_COOKIE, expiresAtValue, expires_in));
    headers.set("Location", targetLocation);

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (callbackError) {
    console.error("Auth callback error", callbackError);
    return redirectResponse(`${APP_URL}/auth?error=server_error`);
  }
}
