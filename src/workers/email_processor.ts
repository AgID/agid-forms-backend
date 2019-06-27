import * as Bull from "bull";
import { log } from "../utils/logger";
import { makeQueueClient } from "./queue_client";

// TODO: send email according to some business logic
function SendmailProcessor(queueClient: Bull.Queue): void {
  queueClient.process("sendmail", async job => {
    log.info("** sendmail processing job : %s", JSON.stringify(job));
  });
}

log.info("** Starts sendmail processor");

SendmailProcessor(makeQueueClient());
