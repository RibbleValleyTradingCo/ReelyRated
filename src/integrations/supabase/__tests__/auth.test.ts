import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildOAuthRedirectUrl, callServerLogout } from "@/lib/auth/helpers";
import { cookieStorage } from "@/integrations/supabase/client";

describe("Auth Flow - SEC-002", () => {
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
     originalLocalStorage = window.localStorage;
     Object.defineProperty(window, "localStorage", {
       configurable: true,
       value: undefined,
     });
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("builds OAuth redirect URL that targets the auth callback endpoint", () => {
    const redirectUrl = buildOAuthRedirectUrl("https://reelyrated.test");
    expect(redirectUrl).toContain("/api/auth/callback");
    expect(redirectUrl).toBe("https://reelyrated.test/api/auth/callback");
  });

  it("calls the server logout endpoint before client signOut and forwards CSRF token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    document.cookie = "sb-csrf-token=test-csrf-token";
    await callServerLogout(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "test-csrf-token" },
    });
  });

  it("throws when CSRF token is missing", async () => {
    const fetchMock = vi.fn();
    await expect(callServerLogout(fetchMock)).rejects.toThrow(/Missing CSRF token/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads stored session JSON from cookies through the storage adapter", () => {
    const sessionPayload = JSON.stringify({ access_token: "token-123" });
    document.cookie = `sb-auth-session=${encodeURIComponent(sessionPayload)}`;
    const storedValue = cookieStorage.getItem("sb-auth-session");
    expect(storedValue).toEqual(sessionPayload);
  });
});
