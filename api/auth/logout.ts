import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
const APP_URL = process.env.VITE_APP_URL ?? "http://localhost:5173";
const ALLOWED_LOGOUT_ORIGINS = (process.env.LOGOUT_ALLOWED_ORIGINS ?? APP_URL)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const ACCESS_TOKEN_COOKIE = "sb-access-token";
const REFRESH_TOKEN_COOKIE = "sb-refresh-token";
const SESSION_COOKIE = "sb-auth-session";
const EXPIRES_AT_COOKIE = "sb-token-expires-at";
const CSRF_COOKIE = "sb-csrf-token";
const CSRF_HEADER = "x-csrf-token";

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, "").toLowerCase();

const allowedOriginSet = new Set(ALLOWED_LOGOUT_ORIGINS.map(normalizeOrigin));

const isOriginAllowed = (headerValue: string | null) => {
  if (!headerValue || allowedOriginSet.size === 0) return true;
  try {
    const parsed = new URL(headerValue);
    return allowedOriginSet.has(normalizeOrigin(`${parsed.protocol}//${parsed.host}`));
  } catch {
    return allowedOriginSet.has(normalizeOrigin(headerValue));
  }
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

const serializeDeletionCookie = (name: string) =>
  `${name}=; Path=/; SameSite=Strict; Max-Age=0`;

const parseCookies = (cookieHeader: string | null) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) {
      return acc;
    }
    acc[rawName] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

const jsonResponse = (body: Record<string, unknown>, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase environment variables are missing");
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const originHeader = req.headers.get("origin") ?? req.headers.get("referer");
  if (!isOriginAllowed(originHeader)) {
    console.warn("Blocked logout from disallowed origin", originHeader);
    return jsonResponse({ error: "Invalid origin" }, 403);
  }

  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieCsrfToken = cookies[CSRF_COOKIE];
  const headerCsrfToken = req.headers.get(CSRF_HEADER);

  if (!cookieCsrfToken || !headerCsrfToken || !timingSafeEqual(cookieCsrfToken, headerCsrfToken)) {
    console.warn("Rejected logout due to CSRF token mismatch");
    return jsonResponse({ error: "Invalid CSRF token" }, 403);
  }

  const refreshToken = cookies[REFRESH_TOKEN_COOKIE];

  if (refreshToken && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await adminClient.auth.admin.signOut(refreshToken);
    } catch (error) {
      console.error("Failed to revoke Supabase session", error);
    }
  }

  const headers = new Headers();
  headers.append("Set-Cookie", serializeDeletionCookie(ACCESS_TOKEN_COOKIE));
  headers.append("Set-Cookie", serializeDeletionCookie(REFRESH_TOKEN_COOKIE));
  headers.append("Set-Cookie", serializeDeletionCookie(SESSION_COOKIE));
  headers.append("Set-Cookie", serializeDeletionCookie(EXPIRES_AT_COOKIE));
  headers.append("Set-Cookie", serializeDeletionCookie(CSRF_COOKIE));

  return jsonResponse({ success: true }, 200, headers);
}
