/**
 * This files contains the typescript declaration of module redis-clustr.
 */

declare module "redis-clustr" {
  import { RedisClient } from "redis";

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

  class RedisClustr extends RedisClient {
    constructor(conf: IOptions);
  }

  export = RedisClustr;
}
