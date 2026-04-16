import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { scrapeRoute } from "./routes/scrape";
import { verifyApiKey } from "./middleware/auth";

const PORT = parseInt(process.env.PORT || "3000", 10);
const VERCEL_DOMAIN = process.env.VERCEL_DOMAIN;

const fastify = Fastify({
  logger: true,
});

// Start server
const start = async () => {
  try {
    // Enable CORS
    await fastify.register(cors, {
      origin: VERCEL_DOMAIN ? `https://${VERCEL_DOMAIN}` : true,
    });

    // Register routes
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

    // Health check endpoint
    fastify.get("/health", async (request, reply) => {
      return { status: "ok", timestamp: Date.now() };
    });

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
  await fastify.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
