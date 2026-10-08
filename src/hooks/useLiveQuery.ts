import { useMemo } from "react";

import { useAppStore } from "@/store/appStore";

/**
 * Runs a synchronous SQLite read and re-runs it whenever the app writes
 * (every write bumps `dataVersion`) or when `key` changes.
 */
export function useLiveQuery<T>(query: () => T, key: unknown = null): T {
  const version = useAppStore((s) => s.dataVersion);
  // `query` is intentionally excluded: callers pass inline closures; `key` names what they depend on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => query(), [version, key]);
}
