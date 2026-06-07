import Redis from "ioredis";

export const ENABLE_REDIS = process.env.ENABLE_REDIS !== "false";
const REDIS_URL = process.env.REDIS_URL;

if (ENABLE_REDIS && !REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set");
}

// Singleton Redis client shared by cache, queue and rate limiter
export const redis = ENABLE_REDIS
  ? new Redis(REDIS_URL!, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    })
  : undefined;

if (redis) {
  redis.on("connect", () => {
    console.log("Connected to Redis");
  });

  redis.on("error", (err) => {
    console.error("Redis connection error:", err);
  });
}
