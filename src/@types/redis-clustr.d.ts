import { RedisClient } from "redis";

/**
 * This files contains the typescript declaration of module redis-clustr.
 */

interface IServer {
  readonly host: string;
  readonly port: number;
}

interface IRedisOptions {
  readonly auth_pass: string;
  readonly tls?: {
    readonly servername: string;
  };
}

interface IOptions {
  readonly redisOptions: IRedisOptions;
  readonly servers: ReadonlyArray<IServer>;
}

declare class RedisClustr extends RedisClient {
  constructor(conf: IOptions);
}
export = RedisClustr;
