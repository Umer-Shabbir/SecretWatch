import Redis from "ioredis";
import { getRedisConnectionOptions } from "@secretwatch/shared";

const globalForRedis = globalThis as unknown as {
  redisClient?: Redis | null;
};

export function getRedisClient(): Redis | null {
  if (globalForRedis.redisClient !== undefined) {
    return globalForRedis.redisClient;
  }

  if (process.env.REDIS_URL) {
    try {
      const opts = getRedisConnectionOptions();
      const client = new Redis(opts as any);
      client.on("error", (err) => {
        console.warn("Global Redis client error:", err);
      });
      globalForRedis.redisClient = client;
      return client;
    } catch (e) {
      console.warn("Failed to initialize Redis client:", e);
      globalForRedis.redisClient = null;
      return null;
    }
  }

  globalForRedis.redisClient = null;
  return null;
}
