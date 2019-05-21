/**
 * Interface for the session storage services.
 */

import { Either } from "fp-ts/lib/Either";
import { SessionToken } from "../types/token";
import { AppUser } from "../types/user";

export interface ISessionStorage {
  /**
   * Stores a value into the cache.
   */
  set(user: AppUser): Promise<Either<Error, boolean>>;

  /**
   * Retrieves a value from the cache using the session token.
   */
  getBySessionToken(token: SessionToken): Promise<Either<Error, AppUser>>;

  /**
   * Removes a value from the cache.
   */
  del(sessionToken: SessionToken): Promise<Either<Error, boolean>>;
}
