import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFollowingIds } from "../useFollowingIds";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("useFollowingIds", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("successful data fetching", () => {
    it("should return empty array for null userId", async () => {
      const { result } = renderHook(() => useFollowingIds(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it("should return empty array for undefined userId", async () => {
      const { result } = renderHook(() => useFollowingIds(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it("should fetch following IDs successfully", async () => {
      const mockFollowingIds = [
        { following_id: "user-1" },
        { following_id: "user-2" },
        { following_id: "user-3" },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: mockFollowingIds,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("test-user-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(["user-1", "user-2", "user-3"]);
      expect(supabase.from).toHaveBeenCalledWith("profile_follows");
      expect(mockSelect).toHaveBeenCalledWith("following_id");
      expect(mockEq).toHaveBeenCalledWith("follower_id", "test-user-id");
    });

    it("should handle empty following list", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("user-with-no-follows"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it("should handle null data from Supabase", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("test-user"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });

    it("should handle large following lists", async () => {
      const mockFollowingIds = Array.from({ length: 100 }, (_, i) => ({
        following_id: `user-${i}`,
      }));

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: mockFollowingIds,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("popular-user"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(100);
      expect(result.current.data[0]).toBe("user-0");
      expect(result.current.data[99]).toBe("user-99");
    });
  });

  describe("error handling", () => {
    it("should handle Supabase errors", async () => {
      const mockError = new Error("Database connection failed");

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("test-user"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });

    it("should handle network errors", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockRejectedValue(new Error("Network error"));

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("test-user"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe("query options", () => {
    it("should not fetch when userId is null", () => {
      const mockFrom = vi.mocked(supabase.from);

      renderHook(() => useFollowingIds(null), {
        wrapper: createWrapper(),
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("should not fetch when userId is undefined", () => {
      const mockFrom = vi.mocked(supabase.from);

      renderHook(() => useFollowingIds(undefined), {
        wrapper: createWrapper(),
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("should not fetch when userId is empty string", () => {
      const mockFrom = vi.mocked(supabase.from);

      renderHook(() => useFollowingIds(""), {
        wrapper: createWrapper(),
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("should return initialData while loading", () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves to keep loading state
          })
      );

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("test-user"), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toEqual([]);
    });

    it("should use correct staleTime", async () => {
      const mockFollowingIds = [{ following_id: "user-1" }];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: mockFollowingIds,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("test-user"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data should not be considered stale for 60 seconds
      expect(result.current.isStale).toBe(false);
    });
  });

  describe("cache behavior", () => {
    it("should use cached data for same userId", async () => {
      const mockFollowingIds = [{ following_id: "user-1" }];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: mockFollowingIds,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      // First render
      const { result: result1 } = renderHook(() => useFollowingIds("test-user"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const callCount = mockEq.mock.calls.length;

      // Second render with same userId
      const { result: result2 } = renderHook(() => useFollowingIds("test-user"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should use cached data, not make another call
      expect(mockEq.mock.calls.length).toBe(callCount);
      expect(result2.current.data).toEqual(["user-1"]);
    });

    it("should fetch separately for different userIds", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockImplementation((field, value) => {
        if (value === "user-1") {
          return Promise.resolve({
            data: [{ following_id: "followed-by-user1" }],
            error: null,
          });
        }
        return Promise.resolve({
          data: [{ following_id: "followed-by-user2" }],
          error: null,
        });
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result: result1 } = renderHook(() => useFollowingIds("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      const { result: result2 } = renderHook(() => useFollowingIds("user-2"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true);
      });

      expect(result1.current.data).toEqual(["followed-by-user1"]);
      expect(result2.current.data).toEqual(["followed-by-user2"]);
    });
  });

  describe("data transformation", () => {
    it("should correctly map following_id to array of strings", async () => {
      const mockFollowingIds = [
        { following_id: "uuid-1" },
        { following_id: "uuid-2" },
        { following_id: "uuid-3" },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: mockFollowingIds,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const { result } = renderHook(() => useFollowingIds("test-user"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(["uuid-1", "uuid-2", "uuid-3"]);
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.data.every((id) => typeof id === "string")).toBe(true);
    });
  });
});
