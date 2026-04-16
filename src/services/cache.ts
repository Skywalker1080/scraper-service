import { redis } from "./redis";
import { ScrapeResponse } from "../types";

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || "86400", 10);

export function getCacheKey(url: string): string {
  return `scrape:${url}`;
}

export const cache = {
  async get(key: string): Promise<ScrapeResponse | null> {
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ScrapeResponse;
    } catch {
      return null;
    }
  },

  async set(key: string, data: ScrapeResponse, ttl: number = DEFAULT_TTL): Promise<void> {
    await redis.set(key, JSON.stringify(data), "EX", ttl);
  },

  async delete(key: string): Promise<void> {
    await redis.del(key);
  },
};
