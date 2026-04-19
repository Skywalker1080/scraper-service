import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";
import { ScrapeResponse } from "../types";
import { cache, getCacheKey } from "./cache";
import { fetchWithMetascraper } from "./metascraper";
import { isYouTubeUrl, fetchYouTubeMetadata } from "../utils/youtube";
import { isTwitterUrl, fetchTwitterMetadata } from "../utils/twitter";
import { getFallbackMetadata } from "../utils/fallback";

const QUEUE_NAME = "scrape-queue";
const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || "5", 10);

export interface ScrapeJobData {
  url: string;
}

// Queue: accepts new scrape jobs
export const scrapeQueue = new Queue<ScrapeJobData>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 500,
  },
});

// Worker: processes up to CONCURRENCY jobs simultaneously
export const scrapeWorker = new Worker<ScrapeJobData, ScrapeResponse>(
  QUEUE_NAME,
  async (job: Job<ScrapeJobData>) => {
    const { url } = job.data;
    const cacheKey = getCacheKey(url);

    // Double-check cache inside worker (another job may have already scraped this URL)
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // YouTube oEmbed
    if (isYouTubeUrl(url)) {
      const youtubeData = await fetchYouTubeMetadata(url);
      if (youtubeData) {
        await cache.set(cacheKey, youtubeData);
        return youtubeData;
      }
    }

    // Twitter / X — never scrape directly (blocked by anti-bot); use oEmbed or branded stub
    if (isTwitterUrl(url)) {
      const twitterData = await fetchTwitterMetadata(url);
      await cache.set(cacheKey, twitterData);
      return twitterData;
    }

    // Metascraper
    try {
      const metadata = await fetchWithMetascraper(url);
      await cache.set(cacheKey, metadata);
      return metadata;
    } catch (err: any) {
      // Re-throw SSRF and payload errors so BullMQ marks job as failed
      if (
        err.message?.includes("SSRF") ||
        err.message?.includes("not a public IP") ||
        err.message?.includes("size limit")
      ) {
        throw err;
      }
      // For other errors, fall back gracefully
      console.error(`Metascraper failed for ${url}:`, err.message);
    }

    // Fallback
    const fallback = getFallbackMetadata(url);
    await cache.set(cacheKey, fallback);
    return fallback;
  },
  {
    connection: redis,
    concurrency: CONCURRENCY,
  }
);

scrapeWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed for URL ${job?.data.url}:`, err.message);
});
