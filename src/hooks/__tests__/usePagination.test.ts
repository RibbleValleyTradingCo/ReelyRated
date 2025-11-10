import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "../usePagination";

describe("usePagination", () => {
  describe("initialization", () => {
    it("should initialize with default values", () => {
      const { result } = renderHook(() => usePagination());

      expect(result.current.page).toBe(0);
      expect(result.current.pageSize).toBe(20);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it("should initialize with custom initialPage", () => {
      const { result } = renderHook(() =>
        usePagination({ initialPage: 5 })
      );

      expect(result.current.page).toBe(5);
    });

    it("should initialize with custom pageSize", () => {
      const { result } = renderHook(() =>
        usePagination({ pageSize: 50 })
      );

      expect(result.current.pageSize).toBe(50);
    });

    it("should initialize with both custom options", () => {
      const { result } = renderHook(() =>
        usePagination({ initialPage: 3, pageSize: 10 })
      );

      expect(result.current.page).toBe(3);
      expect(result.current.pageSize).toBe(10);
    });
  });

  describe("range calculation", () => {
    it("should calculate correct range for first page", () => {
      const { result } = renderHook(() =>
        usePagination({ pageSize: 20 })
      );

      expect(result.current.range).toEqual({ from: 0, to: 19 });
    });

    it("should calculate correct range for second page", () => {
      const { result } = renderHook(() =>
        usePagination({ initialPage: 1, pageSize: 20 })
      );

      expect(result.current.range).toEqual({ from: 20, to: 39 });
    });

    it("should calculate correct range for custom page size", () => {
      const { result } = renderHook(() =>
        usePagination({ initialPage: 2, pageSize: 10 })
      );

      expect(result.current.range).toEqual({ from: 20, to: 29 });
    });

    it("should update range when page changes", () => {
      const { result } = renderHook(() =>
        usePagination({ pageSize: 15 })
      );

      expect(result.current.range).toEqual({ from: 0, to: 14 });

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.range).toEqual({ from: 15, to: 29 });
    });

    it("should calculate range for large page numbers", () => {
      const { result } = renderHook(() =>
        usePagination({ initialPage: 100, pageSize: 50 })
      );

      expect(result.current.range).toEqual({ from: 5000, to: 5049 });
    });
  });

  describe("nextPage", () => {
    it("should increment page when called", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.page).toBe(1);

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.page).toBe(2);
    });

    it("should not increment page when isLoading is true", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setIsLoading(true);
      });

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.page).toBe(0);
    });

    it("should not increment page when hasMore is false", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setHasMore(false);
      });

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.page).toBe(0);
    });

    it("should not increment when both isLoading and hasMore are false", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setIsLoading(true);
        result.current.setHasMore(false);
      });

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.page).toBe(0);
    });

    it("should allow multiple consecutive increments", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.nextPage();
        result.current.nextPage();
        result.current.nextPage();
      });

      expect(result.current.page).toBe(3);
    });
  });

  describe("reset", () => {
    it("should reset page to initial value", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.nextPage();
        result.current.nextPage();
      });

      expect(result.current.page).toBe(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.page).toBe(0);
    });

    it("should reset page to custom initialPage", () => {
      const { result } = renderHook(() =>
        usePagination({ initialPage: 5 })
      );

      act(() => {
        result.current.nextPage();
        result.current.nextPage();
      });

      expect(result.current.page).toBe(7);

      act(() => {
        result.current.reset();
      });

      expect(result.current.page).toBe(5);
    });

    it("should reset hasMore to true", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setHasMore(false);
      });

      expect(result.current.hasMore).toBe(false);

      act(() => {
        result.current.reset();
      });

      expect(result.current.hasMore).toBe(true);
    });

    it("should not reset isLoading", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setIsLoading(true);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("state setters", () => {
    it("should update hasMore state", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setHasMore(false);
      });

      expect(result.current.hasMore).toBe(false);

      act(() => {
        result.current.setHasMore(true);
      });

      expect(result.current.hasMore).toBe(true);
    });

    it("should update isLoading state", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setIsLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setIsLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("should handle typical pagination flow", () => {
      const { result } = renderHook(() =>
        usePagination({ pageSize: 10 })
      );

      // Initial state
      expect(result.current.page).toBe(0);
      expect(result.current.range).toEqual({ from: 0, to: 9 });

      // Start loading
      act(() => {
        result.current.setIsLoading(true);
      });

      // Attempt next page while loading (should be blocked)
      act(() => {
        result.current.nextPage();
      });

      expect(result.current.page).toBe(0);

      // Finish loading
      act(() => {
        result.current.setIsLoading(false);
      });

      // Successfully move to next page
      act(() => {
        result.current.nextPage();
      });

      expect(result.current.page).toBe(1);
      expect(result.current.range).toEqual({ from: 10, to: 19 });
    });

    it("should handle end of data scenario", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.nextPage();
        result.current.nextPage();
      });

      expect(result.current.page).toBe(2);

      // Simulate reaching end of data
      act(() => {
        result.current.setHasMore(false);
      });

      // Attempt next page (should be blocked)
      act(() => {
        result.current.nextPage();
      });

      expect(result.current.page).toBe(2);

      // Reset to start over
      act(() => {
        result.current.reset();
      });

      expect(result.current.page).toBe(0);
      expect(result.current.hasMore).toBe(true);
    });

    it("should handle rapid page changes", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.nextPage();
        }
      });

      expect(result.current.page).toBe(10);
      expect(result.current.range.from).toBe(200);
      expect(result.current.range.to).toBe(219);
    });
  });

  describe("edge cases", () => {
    it("should handle page size of 1", () => {
      const { result } = renderHook(() =>
        usePagination({ pageSize: 1 })
      );

      expect(result.current.range).toEqual({ from: 0, to: 0 });

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.range).toEqual({ from: 1, to: 1 });
    });

    it("should handle very large page size", () => {
      const { result } = renderHook(() =>
        usePagination({ pageSize: 1000 })
      );

      expect(result.current.range).toEqual({ from: 0, to: 999 });
    });

    it("should handle initialPage of 0 explicitly", () => {
      const { result } = renderHook(() =>
        usePagination({ initialPage: 0 })
      );

      expect(result.current.page).toBe(0);
    });

    it("should maintain stable function references", () => {
      const { result, rerender } = renderHook(() => usePagination());

      const initialNextPage = result.current.nextPage;
      const initialReset = result.current.reset;

      rerender();

      expect(result.current.nextPage).toBe(initialNextPage);
      expect(result.current.reset).toBe(initialReset);
    });
  });
});
