import { Either } from "fp-ts/lib/Either";

export interface IObjectStorage<T, TK> {
  /**
   * Stores a value into the cache.
   */
  readonly set: (
    obj: T,
    keyDerivationFn: (obj: T) => string
  ) => Promise<Either<Error, boolean>>;
  /**
   * Retrieves a value from the cache using the key.
   */
  readonly get: (
    key: TK,
    keyDerivationFn?: (k: TK) => string
  ) => Promise<Either<Error, T>>;
  /**
   * Removes a value from the cache.
   */
  readonly del: (
    key: TK,
    keyDerivationFn?: (k: TK) => string
  ) => Promise<Either<Error, boolean>>;
}
