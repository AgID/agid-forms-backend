/**
 * This service uses the Redis client to store and retrieve session information.
 */

import * as redis from "redis";

import { Either, isLeft, left, right } from "fp-ts/lib/Either";
import { ReadableReporter } from "italia-ts-commons/lib/reporters";
import { isNumber } from "util";
import { SessionToken } from "../types/token";
import { AppUser } from "../types/user";
import { log } from "../utils/logger";
import { ISessionStorage } from "./ISessionStorage";

import RedisClustr = require("redis-clustr");
const sessionKeyPrefix = "SESSION-";

export default class RedisSessionStorage implements ISessionStorage {
  constructor(
    private readonly redisClient: redis.RedisClient | RedisClustr,
    private readonly tokenDurationSecs: number
  ) {}

  /**
   * {@inheritDoc}
   */
  public async set(user: AppUser): Promise<Either<Error, boolean>> {
    const setSessionToken = new Promise<Either<Error, boolean>>(resolve => {
      // Set key to hold the string value. If key already holds a value, it is overwritten, regardless of its type.
      // @see https://redis.io/commands/set
      this.redisClient.set(
        `${sessionKeyPrefix}${user.session_token}`,
        JSON.stringify(user),
        "EX",
        this.tokenDurationSecs,
        (err, response) => resolve(this.singleStringReply(err, response))
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
  }

  /**
   * {@inheritDoc}
   */
  public async getBySessionToken(
    token: SessionToken
  ): Promise<Either<Error, AppUser>> {
    const errorOrSession = await this.loadSessionBySessionToken(token);

    if (isLeft(errorOrSession)) {
      const error = errorOrSession.value;
      return left(error);
    }

    const user = errorOrSession.value;

    return right(user);
  }

  /**
   * {@inheritDoc}
   */
  public async del(
    sessionToken: SessionToken
  ): Promise<Either<Error, boolean>> {
    const deleteSessionToken = new Promise<Either<Error, boolean>>(resolve => {
      // Remove the specified key. A key is ignored if it does not exist.
      // @see https://redis.io/commands/del
      this.redisClient.del(
        `${sessionKeyPrefix}${sessionToken}`,
        (err, response) => resolve(this.integerReply(err, response))
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

  /**
   * Return a Session for this token.
   */
  private loadSessionBySessionToken(
    token: SessionToken
  ): Promise<Either<Error, AppUser>> {
    return new Promise(resolve => {
      this.redisClient.get(`${sessionKeyPrefix}${token}`, (err, value) => {
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
  }

  /**
   * Parse the Redis single string reply.
   *
   * @see https://redis.io/topics/protocol#simple-string-reply.
   */
  private singleStringReply(
    err: Error | null,
    reply: "OK" | undefined
  ): Either<Error, boolean> {
    if (err) {
      return left<Error, boolean>(err);
    }
    return right<Error, boolean>(reply === "OK");
  }

  /**
   * Parse the a Redis integer reply.
   *
   * @see https://redis.io/topics/protocol#integer-reply
   */
  // tslint:disable-next-line:no-any
  private integerReply(err: Error | null, reply: any): Either<Error, boolean> {
    if (err) {
      return left<Error, boolean>(err);
    }
    return right<Error, boolean>(isNumber(reply));
  }
}
