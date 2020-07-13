import * as Bull from "bull";
import * as redis from "redis";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { EmailString } from "italia-ts-commons/lib/strings";
import { OMBUDSMAN_EMAIL, FEEDBACK_EMAIL } from "../config";
import { WebhookPayload } from "../controllers/graphql_webhook";
import { emailDeclPublished } from "../templates/html/email/decl_published";
import { emailReportPublished } from "../templates/html/email/report_published";
import { emailAckPublished } from "../templates/html/email/ack_published";
import { emailFeedbackPublished } from "../templates/html/email/feedback_published";
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
              content: declPublishedContent.content,
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
            const reportPublishedContent = emailReportPublished(
              payload.event.data.new,
              userInfo.user[0].email
            );

            const reportPublishedMessage = {
              attachments: reportPublishedContent.attachments,
              content: reportPublishedContent.content,
              subject: reportPublishedContent.title,
              replyTo: reportPublishedContent.replyTo,
              from: reportPublishedContent.from,
              isText: true,
              to: OMBUDSMAN_EMAIL
            };
            log.info(
              "dispatching report-published message to sendmail processor (%s)",
              JSON.stringify(reportPublishedMessage)
            );
            await queueEmail(
              queueClient,
              reportPublishedMessage,
              `publish:${payload.event.data.new.id}_${payload.event.data.new.version}`
            );

            // dispatch published event to email processor
            const ackReportPublishedContent = emailAckPublished();

            const ackReportPublishedMessage = {
              content: ackReportPublishedContent.content,
              subject: ackReportPublishedContent.title,
              to: userInfo.user[0].email
            };
            log.info(
              "dispatching ack-report-published message to sendmail processor (%s)",
              JSON.stringify(ackReportPublishedMessage)
            );
            await queueEmail(
              queueClient,
              ackReportPublishedMessage,
              `publish:${payload.event.data.new.id}_${payload.event.data.new.version}_ack`
            );
          }

          if (
            FEEDBACK_EMAIL &&
            payload.event.data.new &&
            !payload.event.data.old &&
            isNodeOfType(payload, "feedback_accessibilita")
          ) {
            log.info("nuovo feedback accessibilità");

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
            const feedbackPublishedContent = emailFeedbackPublished(
              payload.event.data.new,
              userInfo.user[0].email
            );

            const feedbackPublishedMessage = {
              content: feedbackPublishedContent.content,
              subject: feedbackPublishedContent.title,
              replyTo: feedbackPublishedContent.replyTo,
              from: feedbackPublishedContent.from,
              isText: true,
              to: FEEDBACK_EMAIL
            };
            log.info(
              "dispatching ffedback-published message to sendmail processor (%s)",
              JSON.stringify(feedbackPublishedMessage)
            );
            await queueEmail(
              queueClient,
              feedbackPublishedMessage,
              `publish:${payload.event.data.new.id}_${payload.event.data.new.version}`
            );

            // dispatch published event to email processor
            const ackFeedbackPublishedContent = emailAckPublished();

            const ackFeedbackPublishedMessage = {
              content: ackFeedbackPublishedContent.content,
              subject: ackFeedbackPublishedContent.title,
              to: userInfo.user[0].email
            };
            log.info(
              "dispatching ack-report-published message to sendmail processor (%s)",
              JSON.stringify(ackFeedbackPublishedMessage)
            );
            await queueEmail(
              queueClient,
              ackFeedbackPublishedMessage,
              `publish:${payload.event.data.new.id}_${payload.event.data.new.version}_ack`
            );
          }

        })
        .mapLeft(errs => log.error(readableReport(errs)));
    });
  });
}
