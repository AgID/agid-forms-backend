import * as Bull from "bull";
import * as hash from "object-hash";

import {
  NODE_EVENTS_CHANNEL_NAME,
  QUEUE_INITIAL_DELAY_MS,
  QUEUE_MAX_ATTEMPTS,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_URL
} from "../config";
import { SendmailProcessorInputT } from "../workers/email_processor";
import { log } from "./logger";

export function makeQueueClient(): Bull.Queue {
  return new Bull(NODE_EVENTS_CHANNEL_NAME, REDIS_URL, {
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
}

export function queueEvent<T>(
  queueClient: Bull.Queue,
  payload: T,
  opts: Bull.JobOptions,
  channelName: string
): Promise<Bull.Job<T>> {
  log.info(
    "queue event (%s:%s:%s)",
    JSON.stringify(payload),
    JSON.stringify(opts),
    channelName
  );
  return queueClient.add(channelName, payload, opts);
}

export function queueEmail(
  queueClient: Bull.Queue,
  payload: SendmailProcessorInputT,
  jobId?: string
): Promise<Bull.Job<SendmailProcessorInputT>> {
  return queueEvent(
    queueClient,
    payload,
    {
      jobId: jobId ? `sendmail:${jobId}` : `sendmail:${hash(payload)}`
    },
    "sendmail"
  );
}
