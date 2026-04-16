import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { QueueEvents } from "bullmq";
import { scrapeRoute } from "./routes/scrape";
import { verifyApiKey } from "./middleware/auth";
import { redis } from "./services/redis";
import { scrapeWorker } from "./services/queue";

const PORT = parseInt(process.env.PORT || "3000", 10);
const VERCEL_DOMAIN = process.env.VERCEL_DOMAIN;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "100", 10);

const fastify = Fastify({ logger: true });

// QueueEvents singleton — used by scrapeRoute to await job completion
export const queueEvents = new QueueEvents("scrape-queue", {
  connection: redis,
});

// Start server
const start = async () => {
  try {
    // Enable CORS — only allow requests from the Vercel app
    await fastify.register(cors, {
      origin: VERCEL_DOMAIN ? `https://${VERCEL_DOMAIN}` : true,
    });

    // Rate limiting: 100 requests per minute per IP (backed by Redis)
    await fastify.register(rateLimit, {
      max: RATE_LIMIT_MAX,
      timeWindow: "1 minute",
      redis,
      keyGenerator: (request) =>
        request.ip ?? request.headers["x-forwarded-for"]?.toString() ?? "unknown",
    });

    // POST /scrape — authenticated, rate-limited, queued
    fastify.post(
      "/scrape",
      {
        onRequest: verifyApiKey,
        schema: {
          body: {
            type: "object",
            required: ["url"],
            properties: {
              url: { type: "string" },
            },
          },
        },
      },
      scrapeRoute
    );

    // Health check
    fastify.get("/health", async () => ({
      status: "ok",
      timestamp: Date.now(),
    }));

    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Scraping service running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down gracefully...");
  await scrapeWorker.close();
  await queueEvents.close();
  await redis.quit();
  await fastify.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
