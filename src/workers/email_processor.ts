import * as nodemailer from "nodemailer";
import * as Bull from "bull";
import { log } from "../utils/logger";
import * as t from "io-ts";
import { SMTP_CONNECTION_URL } from "../config";

export const SendmailProcessorInputT = t.interface({
  from: t.string,
  html: t.string,
  replyTo: t.string,
  subject: t.string,
  text: t.string,
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
      .map(
        async sendmailProcessorInput =>
          await nodedmailerTransporter.sendMail(sendmailProcessorInput)
      );
  });
}
