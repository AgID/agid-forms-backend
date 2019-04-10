//
// Redis server settings.
//

import * as redis from "redis";
import RedisClustr = require("redis-clustr");
import { log } from "../utils/logger";

export const DEFAULT_REDIS_PORT = "6379";

export function createSimpleRedisClient(
  redisPort: number,
  redisHost: string,
  redisPassword: string
): redis.RedisClient {
  log.info("Creating SIMPLE redis client", { host: redisHost });
  return redis.createClient(redisPort, redisHost, {
    auth_pass: redisPassword
  });
}

export function createClusterRedisClient(
  redisPort: number,
  redisHost: string,
  redisPassword: string
): RedisClustr {
  log.info("Creating CLUSTER redis client", { host: redisHost });
  return new RedisClustr({
    redisOptions: {
      auth_pass: redisPassword
    },
    servers: [
      {
        host: redisHost,
        port: redisPort
      }
    ]
  });
}
