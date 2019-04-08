//
// Redis server settings.
//
import { none, Option, some } from "fp-ts/lib/Option";
import * as redis from "redis";
import RedisClustr = require("redis-clustr");
import { log } from "../utils/logger";

export const DEFAULT_REDIS_PORT = "6379";

export function createSimpleRedisClient(
  redisUrl = process.env.REDIS_URL || "redis://redis-master"
): Option<redis.RedisClient | RedisClustr> {
  if (redisUrl === undefined) {
    log.error(
      "Missing required environment variables needed to connect to Redis host (REDIS_URL)."
    );
    return none;
  }
  log.info("Creating SIMPLE redis client", { url: redisUrl });
  return some(redis.createClient(redisUrl));
}

export function createClusterRedisClient(
  redisUrl = process.env.REDIS_URL || "redis://redis-master",
  redisPassword = process.env.REDIS_PASSWORD
): Option<redis.RedisClient | RedisClustr> {
  const redisPort: number = parseInt(
    process.env.REDIS_PORT || DEFAULT_REDIS_PORT,
    10
  );

  if (redisUrl === undefined || redisPassword === undefined) {
    log.error(
      "Missing required environment variables needed to connect to Redis host (REDIS_URL, REDIS_PASSWORD)."
    );
    return none;
  }

  log.info("Creating CLUSTER redis client", { url: redisUrl });

  return some(
    new RedisClustr({
      redisOptions: {
        auth_pass: redisPassword,
        tls: {
          servername: redisUrl
        }
      },
      servers: [
        {
          host: redisUrl,
          port: redisPort
        }
      ]
    })
  );
}
