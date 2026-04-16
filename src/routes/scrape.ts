import { FastifyRequest, FastifyReply } from "fastify";
import { ScrapeRequest, ScrapeResponse } from "../types";
import { cache, getCacheKey } from "../services/cache";
import { fetchWithMetascraper } from "../services/metascraper";
import { isYouTubeUrl, fetchYouTubeMetadata } from "../utils/youtube";
import { getFallbackMetadata } from "../utils/fallback";

export async function scrapeRoute(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { url } = request.body as ScrapeRequest;

  // Validate URL
  try {
    new URL(url);
  } catch {
    return reply.status(400).send({ error: "Invalid URL format" });
  }

  const cacheKey = getCacheKey(url);

  try {
    // Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${url}`);
      return reply.send(cached.data);
    }

    console.log(`Cache miss for ${url}, fetching...`);

    let metadata: ScrapeResponse;

    // Try YouTube oEmbed first if applicable
    if (isYouTubeUrl(url)) {
      console.log(`YouTube URL detected, using oEmbed`);
      const youtubeData = await fetchYouTubeMetadata(url);
      if (youtubeData) {
        metadata = youtubeData;
        await cache.set(cacheKey, metadata);
        return reply.send(metadata);
      }
    }

    // Try metascraper
    try {
      console.log(`Attempting metascraper for ${url}`);
      metadata = await fetchWithMetascraper(url);
      await cache.set(cacheKey, metadata);
      return reply.send(metadata);
    } catch (metascraperError: any) {
      console.error(`Metascraper failed for ${url}:`, metascraperError.message);
      
      const errMsg = metascraperError.message || "";
      if (errMsg.includes("SSRF") || errMsg.includes("not a public IP")) {
        return reply.status(400).send({ error: "Invalid URL: Must be a public IP" });
      }
      if (errMsg.includes("size limit")) {
        return reply.status(413).send({ error: "Payload Too Large: File exceeds 5MB limit" });
      }
    }

    // Fallback to hostname-based metadata
    console.log(`Using fallback metadata for ${url}`);
    metadata = getFallbackMetadata(url);
    await cache.set(cacheKey, metadata);
    return reply.send(metadata);
  } catch (error) {
    console.error(`Scraping failed for ${url}:`, error);
    
    // Always return valid metadata to prevent UI breakage
    const fallback = getFallbackMetadata(url);
    return reply.send(fallback);
  }
}
