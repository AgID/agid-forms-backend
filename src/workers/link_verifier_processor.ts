import { AbortController } from "abort-controller";
import * as Bull from "bull";
import { isLeft } from "fp-ts/lib/Either";
import { AbortableFetch } from "italia-ts-commons/lib/fetch";
import { readableReport } from "italia-ts-commons/lib/reporters";
import * as nodeFetch from "node-fetch";
import { WebhookPayload } from "../controllers/graphql_webhook";
import { log } from "../utils/logger";

const FETCH_TIMEOUT_MS = 10000;

// tslint:disable-next-line: no-any
const fetchApi = (nodeFetch as any) as typeof fetch;

// tslint:disable-next-line:no-object-mutation no-any
(global as any).AbortController = AbortController;

const abortableFetch = AbortableFetch(fetchApi);

export function LinkVerifierProcessor(queueClient: Bull.Queue): void {
  queueClient.process("link-verifier", async job => {
    log.info("** link-verifier processing %s", job.id);
    const errorOrPayload = WebhookPayload.decode(JSON.parse(job.data));
    if (isLeft(errorOrPayload)) {
      log.error(
        "** link-verifier cannot deocode data : %s",
        readableReport(errorOrPayload.value)
      );
      throw new Error("Cannot decode data");
    }
    const payload = errorOrPayload.value;
    const node = payload.event.data.new;
    log.debug("** link-verifier processing node %s", JSON.stringify(node));
    if (!node) {
      return;
    }
    // TODO: take this from real field
    // tslint:disable-next-line: no-any
    const url = (node.content as any).values.title;
    log.info("** link-verifier try fetching (%s)", url);
    // request website page and check if contains node id
    const { e1: responsePromise, e2: abortController } = abortableFetch(url);
    log.info("** link-verifier fetching (%s)", url);
    setTimeout(() => {
      abortController.abort();
    }, FETCH_TIMEOUT_MS);
    const res = await responsePromise;
    const body = await res.text();
    if (body.indexOf(node.id) !== -1) {
      // TODO: in case, change the status to published
      log.info("** link-verifier found id (%s=%s)", node.id, url);
    } else {
      log.info("** link-verifier warning : id not found (%s=%s)", node.id, url);
      throw new Error(`Link verifier: cannot find id ${node.id} in ${url}`);
    }
  });
}
