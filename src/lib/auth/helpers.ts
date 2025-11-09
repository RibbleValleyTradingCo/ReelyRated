export const AUTH_CALLBACK_PATH = "/api/auth/callback";
export const LOGOUT_ENDPOINT = "/api/auth/logout";

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, "");

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
    await fetchImpl(LOGOUT_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Failed to call logout endpoint", error);
    throw error;
  }
};
