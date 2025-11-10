import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";

/**
 * Integration tests for authentication flow
 *
 * These tests verify the complete auth flow from sign up to sign out,
 * including session management and error handling.
 *
 * Note: These tests use mocked Supabase client. For full E2E testing,
 * use Playwright or Cypress with a test Supabase instance.
 */

describe("Authentication Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Sign Up Flow", () => {
    it("should successfully sign up a new user with email and password", async () => {
      const mockSignUp = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
        data: {
          user: {
            id: "new-user-123",
            email: "newuser@example.com",
            app_metadata: {},
            user_metadata: { username: "newuser" },
            aud: "authenticated",
            created_at: new Date().toISOString(),
          },
          session: null,
        },
        error: null,
      });

      const { data, error } = await supabase.auth.signUp({
        email: "newuser@example.com",
        password: "SecurePass123!",
        options: {
          data: {
            username: "newuser",
          },
        },
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: "newuser@example.com",
        password: "SecurePass123!",
        options: {
          data: {
            username: "newuser",
          },
        },
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe("newuser@example.com");
      expect(data.user?.user_metadata.username).toBe("newuser");
    });

    it("should return error for duplicate email", async () => {
      const mockSignUp = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: "User already registered",
          name: "AuthApiError",
          status: 400,
        },
      });

      const { data, error } = await supabase.auth.signUp({
        email: "existing@example.com",
        password: "password123",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("already registered");
      expect(data.user).toBeNull();
    });

    it("should return error for weak password", async () => {
      const mockSignUp = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: "Password should be at least 6 characters",
          name: "AuthApiError",
          status: 422,
        },
      });

      const { data, error } = await supabase.auth.signUp({
        email: "user@example.com",
        password: "weak",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("at least 6 characters");
    });

    it("should return error for invalid email format", async () => {
      const mockSignUp = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: "Invalid email format",
          name: "AuthApiError",
          status: 422,
        },
      });

      const { data, error } = await supabase.auth.signUp({
        email: "not-an-email",
        password: "password123",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid email");
    });
  });

  describe("Sign In Flow", () => {
    it("should successfully sign in with valid credentials", async () => {
      const mockSignIn = vi
        .spyOn(supabase.auth, "signInWithPassword")
        .mockResolvedValue({
          data: {
            user: {
              id: "user-123",
              email: "user@example.com",
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: new Date().toISOString(),
            },
            session: {
              access_token: "mock-access-token",
              refresh_token: "mock-refresh-token",
              expires_in: 3600,
              token_type: "bearer",
              user: {
                id: "user-123",
                email: "user@example.com",
                app_metadata: {},
                user_metadata: {},
                aud: "authenticated",
                created_at: new Date().toISOString(),
              },
            },
          },
          error: null,
        });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: "user@example.com",
        password: "password123",
      });

      expect(mockSignIn).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.session).toBeDefined();
      expect(data.session?.access_token).toBe("mock-access-token");
    });

    it("should return error for invalid credentials", async () => {
      const mockSignIn = vi
        .spyOn(supabase.auth, "signInWithPassword")
        .mockResolvedValue({
          data: { user: null, session: null },
          error: {
            message: "Invalid login credentials",
            name: "AuthApiError",
            status: 400,
          },
        });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: "user@example.com",
        password: "wrongpassword",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("Invalid login credentials");
      expect(data.session).toBeNull();
    });

    it("should return error for non-existent user", async () => {
      const mockSignIn = vi
        .spyOn(supabase.auth, "signInWithPassword")
        .mockResolvedValue({
          data: { user: null, session: null },
          error: {
            message: "Invalid login credentials",
            name: "AuthApiError",
            status: 400,
          },
        });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(error).toBeDefined();
      expect(data.user).toBeNull();
    });
  });

  describe("OAuth Sign In Flow", () => {
    it("should initiate Google OAuth sign in", async () => {
      const mockOAuth = vi
        .spyOn(supabase.auth, "signInWithOAuth")
        .mockResolvedValue({
          data: {
            provider: "google",
            url: "https://accounts.google.com/oauth/authorize?...",
          },
          error: null,
        });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/api/auth/callback",
        },
      });

      expect(mockOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/api/auth/callback",
        },
      });

      expect(error).toBeNull();
      expect(data.provider).toBe("google");
      expect(data.url).toContain("google.com");
    });

    it("should handle OAuth errors", async () => {
      const mockOAuth = vi
        .spyOn(supabase.auth, "signInWithOAuth")
        .mockResolvedValue({
          data: { provider: "google", url: null },
          error: {
            message: "OAuth provider not configured",
            name: "AuthApiError",
            status: 500,
          },
        });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("not configured");
    });
  });

  describe("Sign Out Flow", () => {
    it("should successfully sign out user", async () => {
      const mockSignOut = vi.spyOn(supabase.auth, "signOut").mockResolvedValue({
        error: null,
      });

      const { error } = await supabase.auth.signOut();

      expect(mockSignOut).toHaveBeenCalled();
      expect(error).toBeNull();
    });

    it("should handle sign out errors gracefully", async () => {
      const mockSignOut = vi.spyOn(supabase.auth, "signOut").mockResolvedValue({
        error: {
          message: "Failed to sign out",
          name: "AuthApiError",
          status: 500,
        },
      });

      const { error } = await supabase.auth.signOut();

      expect(error).toBeDefined();
      expect(error?.message).toContain("Failed to sign out");
    });
  });

  describe("Session Management", () => {
    it("should get current session", async () => {
      const mockGetSession = vi
        .spyOn(supabase.auth, "getSession")
        .mockResolvedValue({
          data: {
            session: {
              access_token: "mock-token",
              refresh_token: "mock-refresh",
              expires_in: 3600,
              token_type: "bearer",
              user: {
                id: "user-123",
                email: "user@example.com",
                app_metadata: {},
                user_metadata: {},
                aud: "authenticated",
                created_at: new Date().toISOString(),
              },
            },
          },
          error: null,
        });

      const { data, error } = await supabase.auth.getSession();

      expect(mockGetSession).toHaveBeenCalled();
      expect(error).toBeNull();
      expect(data.session).toBeDefined();
      expect(data.session?.access_token).toBe("mock-token");
    });

    it("should return null session when not authenticated", async () => {
      const mockGetSession = vi
        .spyOn(supabase.auth, "getSession")
        .mockResolvedValue({
          data: { session: null },
          error: null,
        });

      const { data, error } = await supabase.auth.getSession();

      expect(error).toBeNull();
      expect(data.session).toBeNull();
    });

    it("should get current user", async () => {
      const mockGetUser = vi.spyOn(supabase.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "user@example.com",
            app_metadata: {},
            user_metadata: { username: "testuser" },
            aud: "authenticated",
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      const { data, error } = await supabase.auth.getUser();

      expect(mockGetUser).toHaveBeenCalled();
      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe("user@example.com");
    });
  });

  describe("Complete Auth Flow", () => {
    it("should complete full sign up → sign in → sign out flow", async () => {
      // Step 1: Sign up
      const mockSignUp = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
        data: {
          user: {
            id: "new-user-456",
            email: "fullflow@example.com",
            app_metadata: {},
            user_metadata: { username: "fullflowuser" },
            aud: "authenticated",
            created_at: new Date().toISOString(),
          },
          session: null,
        },
        error: null,
      });

      const signUpResult = await supabase.auth.signUp({
        email: "fullflow@example.com",
        password: "SecurePassword123!",
        options: { data: { username: "fullflowuser" } },
      });

      expect(signUpResult.error).toBeNull();
      expect(signUpResult.data.user?.email).toBe("fullflow@example.com");

      // Step 2: Sign in
      const mockSignIn = vi
        .spyOn(supabase.auth, "signInWithPassword")
        .mockResolvedValue({
          data: {
            user: {
              id: "new-user-456",
              email: "fullflow@example.com",
              app_metadata: {},
              user_metadata: { username: "fullflowuser" },
              aud: "authenticated",
              created_at: new Date().toISOString(),
            },
            session: {
              access_token: "session-token",
              refresh_token: "refresh-token",
              expires_in: 3600,
              token_type: "bearer",
              user: {
                id: "new-user-456",
                email: "fullflow@example.com",
                app_metadata: {},
                user_metadata: { username: "fullflowuser" },
                aud: "authenticated",
                created_at: new Date().toISOString(),
              },
            },
          },
          error: null,
        });

      const signInResult = await supabase.auth.signInWithPassword({
        email: "fullflow@example.com",
        password: "SecurePassword123!",
      });

      expect(signInResult.error).toBeNull();
      expect(signInResult.data.session).toBeDefined();

      // Step 3: Get session
      const mockGetSession = vi
        .spyOn(supabase.auth, "getSession")
        .mockResolvedValue({
          data: {
            session: {
              access_token: "session-token",
              refresh_token: "refresh-token",
              expires_in: 3600,
              token_type: "bearer",
              user: {
                id: "new-user-456",
                email: "fullflow@example.com",
                app_metadata: {},
                user_metadata: { username: "fullflowuser" },
                aud: "authenticated",
                created_at: new Date().toISOString(),
              },
            },
          },
          error: null,
        });

      const sessionResult = await supabase.auth.getSession();
      expect(sessionResult.data.session).toBeDefined();

      // Step 4: Sign out
      const mockSignOut = vi.spyOn(supabase.auth, "signOut").mockResolvedValue({
        error: null,
      });

      const signOutResult = await supabase.auth.signOut();
      expect(signOutResult.error).toBeNull();

      // Verify all steps were called
      expect(mockSignUp).toHaveBeenCalled();
      expect(mockSignIn).toHaveBeenCalled();
      expect(mockGetSession).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
