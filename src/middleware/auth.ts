import { FastifyRequest, FastifyReply } from "fastify";

import crypto from "crypto";

export async function verifyApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers["x-api-key"] as string;
  const validApiKey = process.env.API_SECRET;

  if (!validApiKey) {
    request.log.warn("API_SECRET not configured in environment");
    return reply.status(500).send({ error: "Server misconfiguration" });
  }

  if (!apiKey) {
    return reply.status(403).send({ error: "Forbidden: Invalid API key" });
  }

  const keyBuffer = Buffer.from(apiKey);
  const validBuffer = Buffer.from(validApiKey);

  if (
    keyBuffer.length !== validBuffer.length ||
    !crypto.timingSafeEqual(keyBuffer, validBuffer)
  ) {
    return reply.status(403).send({ error: "Forbidden: Invalid API key" });
  }

  // API key is valid, proceed to the route handler
}
