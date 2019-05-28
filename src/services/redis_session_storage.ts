/**
 * This service uses the Redis client to store and retrieve session information.
 */

import * as redis from "redis";
import RedisClustr = require("redis-clustr");
import { SessionToken } from "../types/token";
import { AppUser } from "../types/user";
import { IObjectStorage } from "./object_storage";
import { RedisObjectStorage } from "./redis_object_storage";

const SESSION_PREFIX = "SESSION-";

export const RedisSessionStorage = (
  redisClient: redis.RedisClient | RedisClustr,
  tokenDurationSecs: number
): IObjectStorage<AppUser, SessionToken> =>
  RedisObjectStorage(
    redisClient,
    tokenDurationSecs,
    AppUser,
    user => `${SESSION_PREFIX}${user.session_token}`,
    key => `${SESSION_PREFIX}${key}`
  );
