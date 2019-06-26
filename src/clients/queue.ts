import * as RedisSMQ from "rsmq";

export const makeQueueClient = (opts: RedisSMQ.ConstructorOptions): RedisSMQ =>
  new RedisSMQ(opts);
