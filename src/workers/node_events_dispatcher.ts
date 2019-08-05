import * as Bull from "bull";
import * as redis from "redis";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { WebhookPayload } from "../controllers/graphql_webhook";
import { log } from "../utils/logger";

type StatusT = "draft" | "needs_review" | "published" | "archived";
type NodeTypeT = "dichiarazione_accessibilita";

const transitionedTo = (
  payload: WebhookPayload,
  to: StatusT,
  from?: StatusT
) => {
  const newContent = payload.event.data.new;
  const oldContent = payload.event.data.old;
  return (
    oldContent &&
    newContent &&
    (from ? oldContent.status === from : oldContent.status !== to) &&
    newContent.status === to
  );
};

const isNodeOfType = (payload: WebhookPayload, type: NodeTypeT) => {
  const newContent = payload.event.data.new;
  return newContent && newContent.type === type;
};

export function NodeEventsDispatcher(
  queueClient: Bull.Queue,
  redisClient: redis.RedisClient,
  channelName: string
): void {
  redisClient.subscribe(channelName, err => {
    if (err) {
      throw Error("Cannot subscribe");
    }
    redisClient.on("message", (channel, message) => {
      // forward the message into a queue for later processing
      WebhookPayload.decode(JSON.parse(message))
        .map(async payload => {
          log.info(
            "Forwarding received message (%s=%s) on %s",
            channel,
            message,
            channelName
          );
          if (
            isNodeOfType(payload, "dichiarazione_accessibilita") &&
            transitionedTo(payload, "needs_review")
          ) {
            // dispatch to email processor
            log.info("dispatching event to sendmail processor");
            await queueClient.add("sendmail", message, {
              jobId: `sendmail:${payload.id}`
            });
          }
          if (
            isNodeOfType(payload, "dichiarazione_accessibilita") &&
            transitionedTo(payload, "needs_review")
          ) {
            // dispatch to link verifier processor
            log.info("dispatching event to link verifier processor");
            await queueClient.add("link-verifier", message, {
              jobId: `link-verifier:${payload.id}`
            });
          }
        })
        .mapLeft(errs => log.error(readableReport(errs)));
    });
  });
}
