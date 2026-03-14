import { useState, useCallback } from "react";
import { ApiError } from "../lib/api";

interface UseApiResult<T> {
  call: (fn: () => Promise<T>) => Promise<T | null>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useApi<T>(): UseApiResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const call = useCallback(async (fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error, clearError };
}
