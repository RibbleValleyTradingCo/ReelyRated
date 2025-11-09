import { useCallback, useMemo, useState } from "react";

interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const { initialPage = 0, pageSize = 20 } = options;
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const nextPage = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore, isLoading]);

  const reset = useCallback(() => {
    setPage(initialPage);
    setHasMore(true);
  }, [initialPage]);

  const range = useMemo(() => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
  }, [page, pageSize]);

  return {
    page,
    pageSize,
    hasMore,
    isLoading,
    setHasMore,
    setIsLoading,
    nextPage,
    reset,
    range,
  };
}
