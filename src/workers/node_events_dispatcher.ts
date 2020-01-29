import * as Bull from "bull";
import * as redis from "redis";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { EmailString } from "italia-ts-commons/lib/strings";
import { OMBUDSMAN_EMAIL } from "../config";
import { WebhookPayload } from "../controllers/graphql_webhook";
import { emailDeclPublished } from "../templates/html/email/decl_published";
import { emailReportPublished } from "../templates/html/email/report_published";
import { log } from "../utils/logger";
import { queueEmail } from "../utils/queue_client";
import { getUserInfo, isNodeOfType, transitionedTo } from "./utils";

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
          log.info("Forwarding received message on %s", channel, channelName);
          log.debug("Forwarding received message: %s", message);
          if (
            payload.event.data.new &&
            isNodeOfType(payload, "dichiarazione_accessibilita") &&
            transitionedTo(payload, "published")
          ) {
            const userInfo = await getUserInfo(payload.event.data.new.user_id);
            if (!userInfo || !userInfo.user[0].email) {
              log.error(
                "cannot get user email for node %s (id:%s)",
                payload.event.data.new.id,
                payload.event.data.new.user_id
              );
              return;
            }

            // dispatch published event to email processor
            const declPublishedContent = emailDeclPublished(
              payload.event.data.new.id,
              payload.event.data.new.title
            );

            const declPublishedMessage = {
              content: declPublishedContent.html,
              subject: declPublishedContent.title,
              to: userInfo.user[0].email
            };
            log.debug(
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

          if (
            OMBUDSMAN_EMAIL &&
            payload.event.data.new &&
            !payload.event.data.old &&
            isNodeOfType(payload, "procedura_attuazione")
          ) {
            log.info("nuova procedura di attuazione");

            const userInfo = await getUserInfo(payload.event.data.new.user_id);
            if (!userInfo || !EmailString.is(userInfo.user[0].email)) {
              log.error(
                "cannot get user email for node %s (id:%s)",
                payload.event.data.new.id,
                payload.event.data.new.user_id
              );
              return;
            }

            // dispatch published event to email processor
            const declPublishedContent = emailReportPublished(
              payload.event.data.new,
              userInfo.user[0].email
            );

            const reportPublishedMessage = {
              attachments: declPublishedContent.attachments,
              content: declPublishedContent.html,
              subject: declPublishedContent.title,
              to: OMBUDSMAN_EMAIL
            };
            log.debug(
              "dispatching report-published message to sendmail processor (%s)",
              JSON.stringify(reportPublishedMessage)
            );
            await queueEmail(
              queueClient,
              reportPublishedMessage,
              `publish:${payload.event.data.new.id}_${payload.event.data.new.version}`
            );
          }
        })
        .mapLeft(errs => log.error(readableReport(errs)));
    });
  });
}
