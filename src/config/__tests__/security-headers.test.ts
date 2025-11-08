import { describe, it, expect } from "vitest";
import {
  SECURITY_HEADERS,
  CSP_POLICY,
  PERMISSIONS_POLICY,
  getSecurityHeaders,
} from "../security-headers";

describe("Security Headers", () => {
  describe("SECURITY_HEADERS constant", () => {
    it("should have X-Content-Type-Options set to nosniff", () => {
      expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    });

    it("should have X-Frame-Options set to DENY", () => {
      expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    });

    it("should have Referrer-Policy set to same-origin", () => {
      expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("same-origin");
    });

    it("should have Permissions-Policy disabling camera/microphone/geolocation", () => {
      const policy = SECURITY_HEADERS["Permissions-Policy"];
      expect(policy).toContain("camera=()");
      expect(policy).toContain("microphone=()");
      expect(policy).toContain("geolocation=()");
    });

    it("should include Strict-Transport-Security", () => {
      expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("max-age=");
    });
  });

  describe("CSP_POLICY", () => {
    it("should start with default-src self", () => {
      expect(CSP_POLICY).toContain("default-src 'self'");
    });

    it("should restrict script-src to self and CDN", () => {
      expect(CSP_POLICY).toContain("script-src 'self'");
      expect(CSP_POLICY).toContain("https://cdn.jsdelivr.net");
    });

    it("should allow Supabase connections", () => {
      expect(CSP_POLICY).toContain("https://*.supabase.co");
    });

    it("should prevent frame embedding", () => {
      expect(CSP_POLICY).toContain("frame-ancestors 'none'");
    });

    it("should not contain unsafe-eval", () => {
      expect(CSP_POLICY).not.toContain("'unsafe-eval'");
    });
  });

  describe("PERMISSIONS_POLICY", () => {
    it("should disable camera by default", () => {
      expect(PERMISSIONS_POLICY).toContain("camera=()");
    });

    it("should disable microphone by default", () => {
      expect(PERMISSIONS_POLICY).toContain("microphone=()");
    });

    it("should disable geolocation by default", () => {
      expect(PERMISSIONS_POLICY).toContain("geolocation=()");
    });
  });

  describe("getSecurityHeaders", () => {
    it("should include CSP and base headers", () => {
      const headers = getSecurityHeaders();
      expect(headers["Content-Security-Policy"]).toBeDefined();
      expect(headers["X-Frame-Options"]).toBe("DENY");
    });

    it("should return more than five header keys", () => {
      const headers = getSecurityHeaders();
      expect(Object.keys(headers).length).toBeGreaterThan(5);
    });
  });
});
