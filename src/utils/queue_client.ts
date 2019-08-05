import * as Bull from "bull";

import {
  NODE_EVENTS_CHANNEL_NAME,
  QUEUE_INITIAL_DELAY_MS,
  QUEUE_MAX_ATTEMPTS,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_URL
} from "../config";

export const makeQueueClient = () =>
  new Bull(NODE_EVENTS_CHANNEL_NAME, REDIS_URL, {
    defaultJobOptions: {
      attempts: QUEUE_MAX_ATTEMPTS,
      backoff: {
        delay: QUEUE_INITIAL_DELAY_MS,
        type: "exponential"
      }
      // removeOnComplete: true,
      // removeOnFail: true
    },
    redis: {
      host: REDIS_URL,
      password: REDIS_PASSWORD,
      port: parseInt(REDIS_PORT, 10)
    }
  });
