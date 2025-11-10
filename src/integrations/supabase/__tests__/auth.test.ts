import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildOAuthRedirectUrl, callServerLogout } from "@/lib/auth/helpers";
import { cookieStorage } from "@/integrations/supabase/client";

describe("Auth Flow - SEC-002", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  it("builds OAuth redirect URL that targets the auth callback endpoint", () => {
    const redirectUrl = buildOAuthRedirectUrl("https://reelyrated.test");
    expect(redirectUrl).toContain("/api/auth/callback");
    expect(redirectUrl).toBe("https://reelyrated.test/api/auth/callback");
  });

  it("calls the server logout endpoint before client signOut", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await callServerLogout(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("reads stored session JSON from cookies through the storage adapter", () => {
    const sessionPayload = JSON.stringify({ access_token: "token-123" });
    document.cookie = `sb-auth-session=${encodeURIComponent(sessionPayload)}`;
    const storedValue = cookieStorage.getItem("sb-auth-session");
    expect(storedValue).toEqual(sessionPayload);
  });
});
