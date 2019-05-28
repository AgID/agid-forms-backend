/**
 * This service uses the Redis client to store and retrieve session information.
 */

import * as redis from "redis";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { ReadableReporter } from "italia-ts-commons/lib/reporters";

import { SessionToken } from "../types/token";
import { AppUser } from "../types/user";
import { log } from "../utils/logger";
import { ISessionStorage } from "./ISessionStorage";

import RedisClustr = require("redis-clustr");
import { integerReply, singleStringReply } from "../utils/redis";
const sessionKeyPrefix = "SESSION-";

/**
 * Return a Session for this token.
 */
const loadSessionBySessionToken = (
  redisClient: redis.RedisClient | RedisClustr,
  token: SessionToken
): Promise<Either<Error, AppUser>> => {
  return new Promise(resolve => {
    redisClient.get(`${sessionKeyPrefix}${token}`, (err, value) => {
      if (err) {
        // Client returns an error.
        return resolve(left<Error, AppUser>(err));
      }

      if (value === null) {
        return resolve(left<Error, AppUser>(new Error("Session not found")));
      }

      // Try-catch is needed because parse() may throw an exception.
      try {
        const userPayload = JSON.parse(value);
        const errorOrDeserializedUser = AppUser.decode(userPayload);

        if (isLeft(errorOrDeserializedUser)) {
          log.error(
            "Unable to decode the user: %s",
            ReadableReporter.report(errorOrDeserializedUser)
          );
          return resolve(
            left<Error, AppUser>(new Error("Unable to decode the user"))
          );
        }

        const user = errorOrDeserializedUser.value;
        return resolve(right<Error, AppUser>(user));
      } catch (err) {
        return resolve(
          left<Error, AppUser>(new Error("Unable to parse the user json"))
        );
      }
    });
  });
};

export const RedisSessionStorage = (
  redisClient: redis.RedisClient | RedisClustr,
  tokenDurationSecs: number
): ISessionStorage => ({
  set: async (user: AppUser): Promise<Either<Error, boolean>> => {
    const setSessionToken = new Promise<Either<Error, boolean>>(resolve => {
      // Set key to hold the string value. If key already holds a value, it is overwritten, regardless of its type.
      // @see https://redis.io/commands/set
      redisClient.set(
        `${sessionKeyPrefix}${user.session_token}`,
        JSON.stringify(user),
        "EX",
        tokenDurationSecs,
        (err, response) => resolve(singleStringReply(err, response))
      );
    });
    const setSessionTokenResult = await setSessionToken;
    if (isLeft(setSessionTokenResult)) {
      return left<Error, boolean>(
        new Error(`Error setting the token: ${setSessionTokenResult.value}`)
      );
    }
    if (!setSessionTokenResult.value) {
      return left<Error, boolean>(
        new Error("Error setting the token (empty response)")
      );
    }
    return right<Error, boolean>(true);
  },

  getBySessionToken: async (
    token: SessionToken
  ): Promise<Either<Error, AppUser>> => {
    const errorOrSession = await loadSessionBySessionToken(redisClient, token);
    if (isLeft(errorOrSession)) {
      const error = errorOrSession.value;
      return left(error);
    }
    const user = errorOrSession.value;
    return right(user);
  },

  del: async (sessionToken: SessionToken): Promise<Either<Error, boolean>> => {
    const deleteSessionToken = new Promise<Either<Error, boolean>>(resolve => {
      // Remove the specified key. A key is ignored if it does not exist.
      // @see https://redis.io/commands/del
      redisClient.del(`${sessionKeyPrefix}${sessionToken}`, (err, response) =>
        resolve(integerReply(err, response))
      );
    });

    const deleteSessionTokenResult = await deleteSessionToken;

    if (isLeft(deleteSessionTokenResult)) {
      return left<Error, boolean>(new Error("Error deleting the token"));
    }

    if (!deleteSessionTokenResult.value) {
      return left<Error, boolean>(new Error("Error deleting the token"));
    }

    return right<Error, boolean>(true);
  }
});
