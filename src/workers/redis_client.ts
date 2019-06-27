import { REDIS_PASSWORD, REDIS_PORT, REDIS_URL } from "../config";

import { createSimpleRedisClient } from "../utils/redis";

export const makeRedisClient = () =>
  createSimpleRedisClient(parseInt(REDIS_PORT, 10), REDIS_URL, REDIS_PASSWORD);
