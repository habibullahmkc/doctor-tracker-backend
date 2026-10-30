/**
 * Tiny in-process TTL cache with request coalescing.
 *
 * - Concurrent callers for the same key share one in-flight promise, so a burst
 *   of dashboard loads runs the aggregations once.
 * - Writes call `invalidate()` so cached analytics are never stale after a change.
 *
 * Scope: a single API instance. With several instances this would move to Redis
 * (same interface: getOrSet / invalidate).
 */
interface Entry<T> {
  expiresAt: number;
  value: Promise<T>;
}

export class TtlCache {
  private readonly store = new Map<string, Entry<unknown>>();

  constructor(private readonly now: () => number = Date.now) {}

  getOrSet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key) as Entry<T> | undefined;
    if (hit && hit.expiresAt > this.now()) return hit.value;

    const value = load();
    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
    // Never cache failures.
    value.catch(() => {
      if (this.store.get(key)?.value === value) this.store.delete(key);
    });
    return value;
  }

  /** Remove every key starting with `prefix` (all keys when omitted). */
  invalidate(prefix = "") {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  get size() {
    return this.store.size;
  }
}

export const cache = new TtlCache();

export const CACHE_KEYS = {
  dashboard: (range: string) => `dashboard:${range}`,
  doctorFilters: "doctors:filters",
} as const;

/** Call after any doctor/patient write. */
export function invalidateAnalytics() {
  cache.invalidate("dashboard:");
  cache.invalidate(CACHE_KEYS.doctorFilters);
}
