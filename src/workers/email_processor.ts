import * as Bull from "bull";
import * as htmlToText from "html-to-text";
import * as t from "io-ts";
import * as nodemailer from "nodemailer";

import {
  AUTHMAIL_FROM,
  AUTHMAIL_REPLY_TO,
  AUTHMAIL_TEST_ADDRESS,
  ORGANIZATION_NAME,
  SERVICE_NAME,
  SMTP_CONNECTION_URL
} from "../config";
import { withDefaultEmailTemplate } from "../templates/html/default";
import { log } from "../utils/logger";

export const SendmailProcessorInputT = t.interface({
  content: t.string,
  subject: t.string,
  to: t.string
});
export type SendmailProcessorInputT = t.TypeOf<typeof SendmailProcessorInputT>;

const nodedmailerTransporter = nodemailer.createTransport(SMTP_CONNECTION_URL);

export function SendmailProcessor(queueClient: Bull.Queue): void {
  queueClient.process("sendmail", job => {
    log.info("** sendmail processing job : %s", JSON.stringify(job));
    SendmailProcessorInputT.decode(job.data)
      .mapLeft(err => {
        log.error("** sendmail processor: cannot decode input");
        log.debug(
          "** error: %s:%s",
          JSON.stringify(err),
          JSON.stringify(job.data)
        );
      })
      .map(async sendmailProcessorInput => {
        const emailHtml = withDefaultEmailTemplate(
          sendmailProcessorInput.subject,
          ORGANIZATION_NAME,
          SERVICE_NAME,
          sendmailProcessorInput.content
        );
        const message = {
          from: AUTHMAIL_FROM || "",
          html: emailHtml,
          replyTo: AUTHMAIL_REPLY_TO || "",
          subject: sendmailProcessorInput.subject,
          text: htmlToText.fromString(emailHtml),
          to: AUTHMAIL_TEST_ADDRESS || sendmailProcessorInput.to
        };
        log.debug("** sending email: %s", JSON.stringify(message));
        try {
          await nodedmailerTransporter.sendMail(message);
        } catch (e) {
          log.error("** sending mail: error: %s", JSON.stringify(e));
        }
      });
  });
}
