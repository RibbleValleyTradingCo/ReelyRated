import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildOAuthRedirectUrl,
  callServerLogout,
  AUTH_CALLBACK_PATH,
} from "../helpers";

// Mock document.cookie
let mockCookies: Record<string, string> = {};

beforeEach(() => {
  mockCookies = {};

  // Mock document.cookie getter/setter
  Object.defineProperty(document, "cookie", {
    get: () => {
      return Object.entries(mockCookies)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
    },
    set: (cookieStr: string) => {
      const [nameValue] = cookieStr.split(";");
      const [name, value] = nameValue.split("=");
      if (value) {
        mockCookies[name.trim()] = value.trim();
      } else {
        // Deletion (expires in past)
        delete mockCookies[name.trim()];
      }
    },
    configurable: true,
  });
});

afterEach(() => {
  mockCookies = {};
});

describe("Auth Helpers", () => {
  describe("buildOAuthRedirectUrl", () => {
    it("should use origin parameter when provided", () => {
      const result = buildOAuthRedirectUrl("https://example.com");
      expect(result).toBe("https://example.com/api/auth/callback");
    });

    it("should normalize trailing slashes", () => {
      const result = buildOAuthRedirectUrl("https://example.com/");
      expect(result).toBe("https://example.com/api/auth/callback");
    });

    it("should return callback path when no origin available", () => {
      const result = buildOAuthRedirectUrl();
      expect(result).toBe(AUTH_CALLBACK_PATH);
    });

    it("should handle multiple trailing slashes", () => {
      const result = buildOAuthRedirectUrl("https://example.com///");
      expect(result).toBe("https://example.com///api/auth/callback");
    });

    it("should work with http protocol", () => {
      const result = buildOAuthRedirectUrl("http://localhost:3000");
      expect(result).toBe("http://localhost:3000/api/auth/callback");
    });
  });

  describe("getCookieValue (via callServerLogout)", () => {
    it("should extract CSRF token from cookies", async () => {
      mockCookies["sb-csrf-token"] = "test-token-123";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "test-token-123",
        },
      });
    });

    it("should decode URI-encoded cookie values", async () => {
      mockCookies["sb-csrf-token"] = "hello%20world%3D123";

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-CSRF-Token": "hello world=123",
          }),
        })
      );
    });
  });

  describe("callServerLogout", () => {
    it("should call logout endpoint with CSRF token", async () => {
      mockCookies["sb-csrf-token"] = "test-token";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "test-token",
        },
      });
    });

    it("should throw when CSRF token missing", async () => {
      // No CSRF token in cookies
      const mockFetch = vi.fn();

      await expect(callServerLogout(mockFetch)).rejects.toThrow(
        "Missing CSRF token"
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should throw when fetch fails", async () => {
      mockCookies["sb-csrf-token"] = "test-token";

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(callServerLogout(mockFetch)).rejects.toThrow(
        "Network error"
      );
    });

    it("should include credentials in request", async () => {
      mockCookies["sb-csrf-token"] = "test-token";

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("should use POST method", async () => {
      mockCookies["sb-csrf-token"] = "test-token";

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should set correct content type", async () => {
      mockCookies["sb-csrf-token"] = "test-token";

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("CSRF Token Edge Cases", () => {
    it("should handle cookies with equals signs in value", async () => {
      mockCookies["sb-csrf-token"] = "eyJhbGc=value";

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-CSRF-Token": "eyJhbGc=value",
          }),
        })
      );
    });

    it("should handle multiple cookies", async () => {
      mockCookies["other-cookie"] = "other-value";
      mockCookies["sb-csrf-token"] = "csrf-value";
      mockCookies["another-cookie"] = "another-value";

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });

      await callServerLogout(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-CSRF-Token": "csrf-value",
          }),
        })
      );
    });
  });
});
