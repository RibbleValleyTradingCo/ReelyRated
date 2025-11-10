import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

const ACCESS_TOKEN_COOKIE = "sb-access-token";
const REFRESH_TOKEN_COOKIE = "sb-refresh-token";
const SESSION_COOKIE = "sb-auth-session";
const EXPIRES_AT_COOKIE = "sb-token-expires-at";

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

  const cookies = parseCookies(req.headers.get("cookie"));
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

  return jsonResponse({ success: true }, 200, headers);
}
