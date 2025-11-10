import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("test", 300));
    expect(result.current).toBe("test");
  });

  it("should debounce value changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    );

    expect(result.current).toBe("initial");

    // Update value
    rerender({ value: "updated", delay: 300 });

    // Should still have initial value before timeout
    expect(result.current).toBe("initial");

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should have updated value after timeout
    expect(result.current).toBe("updated");
  });

  it("should cancel pending update on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { result, unmount, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: "initial" },
      }
    );

    rerender({ value: "updated" });

    // Unmount before timeout completes
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("should handle rapid successive changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: "initial" },
      }
    );

    // Rapid changes
    rerender({ value: "change1" });
    act(() => vi.advanceTimersByTime(100));

    rerender({ value: "change2" });
    act(() => vi.advanceTimersByTime(100));

    rerender({ value: "final" });

    // Should still have initial value
    expect(result.current).toBe("initial");

    // Complete the debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should only have final value
    expect(result.current).toBe("final");
  });

  it("should use default delay of 300ms", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: "initial" },
      }
    );

    rerender({ value: "updated" });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("updated");
  });

  it("should respect custom delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      }
    );

    rerender({ value: "updated", delay: 500 });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("updated");
  });

  it("should handle string values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: "hello" },
      }
    );

    rerender({ value: "world" });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("world");
  });

  it("should handle number values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: 123 },
      }
    );

    rerender({ value: 456 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(456);
  });

  it("should handle boolean values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: true },
      }
    );

    rerender({ value: false });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe(false);
  });

  it("should handle object values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: { name: "John" } },
      }
    );

    const newValue = { name: "Jane" };
    rerender({ value: newValue });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toEqual(newValue);
  });

  it("should handle array values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: [1, 2, 3] },
      }
    );

    const newValue = [4, 5, 6];
    rerender({ value: newValue });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toEqual(newValue);
  });

  it("should handle null values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: null as string | null },
      }
    );

    rerender({ value: "value" });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("value");
  });

  it("should handle undefined values", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: undefined as string | undefined },
      }
    );

    rerender({ value: "value" });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("value");
  });

  it("should reset debounce when delay changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 300 },
      }
    );

    rerender({ value: "updated", delay: 300 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Change delay mid-debounce
    rerender({ value: "updated", delay: 500 });

    // Old timer should be cancelled, new timer started
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("updated");
  });

  it("should handle zero delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      {
        initialProps: { value: "initial" },
      }
    );

    rerender({ value: "updated" });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe("updated");
  });

  it("should handle very long delays", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 5000),
      {
        initialProps: { value: "initial" },
      }
    );

    rerender({ value: "updated" });

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("updated");
  });

  it("should cleanup timeout on value change before completion", () => {
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      {
        initialProps: { value: "initial" },
      }
    );

    rerender({ value: "change1" });
    const timeoutCount1 = clearTimeoutSpy.mock.calls.length;

    rerender({ value: "change2" });
    const timeoutCount2 = clearTimeoutSpy.mock.calls.length;

    // Should have cleared timeout for change1
    expect(timeoutCount2).toBeGreaterThan(timeoutCount1);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("change2");
  });
});
