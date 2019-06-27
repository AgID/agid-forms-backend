//
// Redis server settings.
//

import { Either, left, right } from "fp-ts/lib/Either";
import * as redis from "redis";
import RedisClustr = require("redis-clustr");
import { isNumber } from "util";
import { log } from "../utils/logger";

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

/**
 * Parse the Redis single string reply.
 *
 * @see https://redis.io/topics/protocol#simple-string-reply.
 */
export const singleStringReply = (
  err: Error | null,
  reply: "OK" | undefined
): Either<Error, boolean> => {
  if (err) {
    return left<Error, boolean>(err);
  }
  return right<Error, boolean>(reply === "OK");
};

/**
 * Parse the a Redis integer reply.
 *
 * @see https://redis.io/topics/protocol#integer-reply
 */
export const integerReply = (
  err: Error | null,
  // tslint:disable-next-line:no-any
  reply: any
): Either<Error, boolean> => {
  if (err) {
    return left<Error, boolean>(err);
  }
  return right<Error, boolean>(isNumber(reply));
};
