export const AUTH_CALLBACK_PATH = "/api/auth/callback";
export const LOGOUT_ENDPOINT = "/api/auth/logout";
const CSRF_COOKIE_NAME = "sb-csrf-token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, "");

const getCookieValue = (name: string) => {
  if (typeof document === "undefined" || !document.cookie) {
    return null;
  }
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
};

const requireCsrfToken = () => {
  const token = getCookieValue(CSRF_COOKIE_NAME);
  if (!token) {
    throw new Error("Missing CSRF token. Please refresh and try again.");
  }
  return token;
};

export const buildOAuthRedirectUrl = (origin?: string): string => {
  const envUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_APP_URL : undefined;
  const runtimeOrigin =
    origin ||
    envUrl ||
    (typeof window !== "undefined" && window.location ? window.location.origin : "");

  if (!runtimeOrigin) {
    return AUTH_CALLBACK_PATH;
  }

  return `${normalizeOrigin(runtimeOrigin)}${AUTH_CALLBACK_PATH}`;
};

export const callServerLogout = async (fetchImpl: typeof fetch = fetch) => {
  try {
    const csrfToken = requireCsrfToken();
    await fetchImpl(LOGOUT_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: csrfToken,
      },
    });
  } catch (error) {
    console.error("Failed to call logout endpoint", error);
    throw error;
  }
};
