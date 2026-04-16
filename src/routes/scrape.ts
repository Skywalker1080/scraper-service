import { FastifyRequest, FastifyReply } from "fastify";
import { ScrapeRequest, ScrapeResponse } from "../types";
import { cache, getCacheKey } from "../services/cache";
import { scrapeQueue } from "../services/queue";
import { queueEvents } from "../index";

export async function scrapeRoute(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { url } = request.body as ScrapeRequest;

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return reply.status(400).send({ error: "Invalid URL format" });
  }

  const cacheKey = getCacheKey(url);

  // 1. Cache hit — return immediately, no queue needed
  const cached = await cache.get(cacheKey);
  if (cached) {
    request.log.info(`Cache hit for ${url}`);
    return reply.send(cached);
  }

  // 2. Cache miss — enqueue and wait for the result (max 18s, safe under Vercel 20s limit)
  request.log.info(`Cache miss for ${url}, enqueuing...`);

  let job;
  try {
    job = await scrapeQueue.add("scrape", { url });
  } catch (err) {
    request.log.error(`Failed to enqueue job for ${url}: ${String(err)}`);
    return reply.status(500).send({ error: "Failed to queue scrape job" });
  }

  try {
    const result = await job.waitUntilFinished(queueEvents, 18000);
    return reply.send(result as ScrapeResponse);
  } catch (err: any) {
    const msg = err.message || "";

    if (msg.includes("SSRF") || msg.includes("not a public IP")) {
      return reply.status(400).send({ error: "Invalid URL: Must be a public IP" });
    }
    if (msg.includes("size limit")) {
      return reply.status(413).send({ error: "Payload Too Large: File exceeds 5MB limit" });
    }
    if (msg.includes("timed out")) {
      return reply.status(504).send({ error: "Scrape job timed out" });
    }

    request.log.error(`Job failed for ${url}:`, msg);
    return reply.status(500).send({ error: "Scraping failed" });
  }
}
