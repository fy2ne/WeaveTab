import type { Config } from "../config/loader.js";

export interface RateLimitAllowed {
  allowed: true;
}

export interface RateLimitBlocked {
  allowed: false;
  retryAfterMs: number;
}

export type RateLimitResult = RateLimitAllowed | RateLimitBlocked;

// Circular buffer of timestamps — one slot per allowed action in the window
const WINDOW_MS = 60_000;
let timestamps: number[] = [];

export function checkRateLimit(config: Config): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Evict expired timestamps (sliding window)
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= config.maxActionsPerMinute) {
    // Oldest timestamp tells us when a slot frees up
    const oldestInWindow = timestamps[0]!;
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  return { allowed: true };
}

export function resetRateLimit(): void {
  timestamps = [];
}
