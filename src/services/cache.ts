import { CacheEntry } from "../types";

// In-memory cache (can be easily replaced with Redis)
// Redis migration: Replace Map with Redis client (ioredis)
// Use same async get/set API for seamless swap
class InMemoryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL: number;

  constructor(ttlSeconds: number = 86400) {
    this.defaultTTL = ttlSeconds * 1000; // Convert to milliseconds
  }

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  async set(key: string, data: any, ttl?: number): Promise<void> {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

// Cache key pattern: scrape:${url}
// Redis migration: Use this same pattern with Redis
export function getCacheKey(url: string): string {
  return `scrape:${url}`;
}

// Export singleton instance
const cacheTTL = parseInt(process.env.CACHE_TTL || "86400", 10);
export const cache = new InMemoryCache(cacheTTL);
