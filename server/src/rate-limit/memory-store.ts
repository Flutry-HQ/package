import type { RateLimitCounter } from './types';

interface RecordEntry {
  count: number;
  expiresAt: number;
}

/** Insertion order is expiration order: every entry has the same fixed window. */
export class MemoryRateLimitStore {
  private readonly entries = new Map<string, RecordEntry>();

  constructor(
    private readonly max: number,
    private readonly windowMilliseconds: number,
    private readonly capacity: number,
    private readonly now: () => number = () => performance.now(),
  ) {}

  public consume(key: string): RateLimitCounter {
    const now = this.now();
    this.cleanup(now);

    let entry = this.entries.get(key);

    if (!entry) {
      // Evicting active entries would let clients reset their quotas by churning keys.
      if (this.entries.size >= this.capacity) {
        throw new Error('In-memory rate limit capacity exhausted');
      }

      entry = { count: 0, expiresAt: now + this.windowMilliseconds };
      this.entries.set(key, entry);
    }

    const allowed = entry.count < this.max;

    if (allowed) {
      entry.count++;
    }

    return { allowed, count: entry.count, ttlMilliseconds: Math.max(0, entry.expiresAt - now) };
  }

  public cleanup(now = this.now()): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt > now) break;
      this.entries.delete(key);
    }
  }

  public get size(): number {
    this.cleanup();
    return this.entries.size;
  }

  public clear(): void {
    this.entries.clear();
  }
}
