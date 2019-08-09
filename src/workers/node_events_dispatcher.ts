import * as Bull from "bull";
import * as redis from "redis";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { GET_USER_INFO, GraphqlClient } from "../clients/graphql";
import { WebhookPayload } from "../controllers/graphql_webhook";
import {
  GetUserInfo,
  GetUserInfoVariables
} from "../generated/graphql/GetUserInfo";
import { emailDeclPublished } from "../templates/html/email/decl_published";
import { log } from "../utils/logger";
import { queueEmail } from "../utils/queue_client";

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

// tslint:disable-next-line: cognitive-complexity
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
            payload.event.data.new &&
            isNodeOfType(payload, "dichiarazione_accessibilita") &&
            transitionedTo(payload, "published")
          ) {
            // dispatch published event to email processor
            const declPublishedContent = emailDeclPublished(
              payload.event.data.new.id
            );

            // get user email
            const errorOrUserInfo = await GraphqlClient.query<
              GetUserInfo,
              GetUserInfoVariables
            >({
              query: GET_USER_INFO,
              variables: {
                id: payload.event.data.new.user_id
              }
            });
            if (errorOrUserInfo.errors) {
              log.error(errorOrUserInfo.errors.join("\n"));
              return;
            }

            const userInfo = errorOrUserInfo.data;
            if (!userInfo || !userInfo.user[0].email) {
              log.error(
                "cannot get user email for node %s (id:%s)",
                payload.event.data.new.id,
                payload.event.data.new.user_id
              );
              return;
            }

            const declPublishedMessage = {
              content: declPublishedContent.html,
              subject: declPublishedContent.title,
              to: userInfo.user[0].email
            };
            log.info(
              "dispatching decl-published message to sendmail processor (%s)",
              JSON.stringify(declPublishedMessage)
            );
            await queueEmail(
              queueClient,
              declPublishedMessage,
              `publish:${payload.event.data.new.id}_${payload.event.data.new.version}`
            );
          }
          if (
            isNodeOfType(payload, "dichiarazione_accessibilita") &&
            transitionedTo(payload, "published")
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
