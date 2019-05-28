/**
 * This service uses the Redis client to store and retrieve information.
 */

import * as t from "io-ts";
import * as redis from "redis";

import { Either, isLeft, left, right, tryCatch2v } from "fp-ts/lib/Either";
import { ReadableReporter } from "italia-ts-commons/lib/reporters";

import { log } from "../utils/logger";

import RedisClustr = require("redis-clustr");
import { integerReply, singleStringReply } from "../utils/redis";
import { IObjectStorage } from "./object_storage";

/**
 * Return an object for this key.
 */
const loadObjectByKey = <T, TK>(
  redisClient: redis.RedisClient | RedisClustr,
  key: TK,
  type: t.Type<T>,
  keyDerivationFn: (k: TK) => string
): Promise<Either<Error, T>> => {
  return new Promise(resolve => {
    redisClient.get(keyDerivationFn(key), (err, value) => {
      if (err) {
        // Client returns an error.
        return resolve(left(err));
      }
      if (value === null) {
        return resolve(left(new Error("Object not found")));
      }
      return tryCatch2v(
        () => JSON.parse(value),
        e =>
          new Error(
            `Unable to parse the object json ${
              e instanceof Error ? e.message : ""
            }`
          )
      ).map(objectPayload => {
        type.decode(objectPayload).fold(
          l => {
            log.error(
              "loadObjectByKey: unable to decode the object: %s",
              ReadableReporter.report(left(l))
            );
            return resolve(left(new Error("Unable to decode the object")));
          },
          object => resolve(right(object))
        );
      });
    });
  });
};

export const RedisObjectStorage = <T, TK = string>(
  redisClient: redis.RedisClient | RedisClustr,
  tokenDurationSecs: number,
  type: t.Type<T>,
  setKeyDerivationFn: (obj: T) => string,
  getKeyDerivationFn: (k: TK) => string
): IObjectStorage<T, TK> => ({
  set: async (
    obj: T,
    keyDerivationFn: (obj: T) => string = setKeyDerivationFn
  ): Promise<Either<Error, boolean>> => {
    const setObjectPromise = new Promise<Either<Error, boolean>>(resolve => {
      // Set key to hold the string value. If key already holds a value, it is overwritten, regardless of its type.
      // @see https://redis.io/commands/set
      redisClient.set(
        keyDerivationFn(obj),
        JSON.stringify(obj),
        "EX",
        tokenDurationSecs,
        (err, response) => resolve(singleStringReply(err, response))
      );
    });
    const setObjectResult = await setObjectPromise;
    if (isLeft(setObjectResult) || !setObjectResult.value) {
      return left<Error, boolean>(
        new Error(
          `Error setting the object: ${JSON.stringify(setObjectResult.value)}`
        )
      );
    }
    return right<Error, boolean>(true);
  },

  get: async (
    key: TK,
    keyDerivationFn: (k: TK) => string = getKeyDerivationFn
  ): Promise<Either<Error, T>> =>
    loadObjectByKey(redisClient, key, type, keyDerivationFn),

  del: async (
    key: TK,
    keyDerivationFn: (k: TK) => string = getKeyDerivationFn
  ): Promise<Either<Error, boolean>> => {
    const deleteObjectPromise = new Promise<Either<Error, boolean>>(resolve => {
      // Remove the specified key. A key is ignored if it does not exist.
      // @see https://redis.io/commands/del
      redisClient.del(keyDerivationFn(key), (err, response) =>
        resolve(integerReply(err, response))
      );
    });
    const deleteObjectResult = await deleteObjectPromise;
    if (isLeft(deleteObjectResult) || !deleteObjectResult.value) {
      return left<Error, boolean>(
        new Error(
          `Error deleting the object: ${JSON.stringify(
            deleteObjectResult.value
          )}`
        )
      );
    }
    return right<Error, boolean>(true);
  }
});
