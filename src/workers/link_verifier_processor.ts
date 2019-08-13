import { AbortController } from "abort-controller";
import * as Bull from "bull";
import { isLeft } from "fp-ts/lib/Either";
import gql from "graphql-tag";
import { AbortableFetch } from "italia-ts-commons/lib/fetch";
import { readableReport } from "italia-ts-commons/lib/reporters";
import * as nodeFetch from "node-fetch";
import { GraphqlClient } from "../clients/graphql";
import { WebhookPayload } from "../controllers/graphql_webhook";
import {
  GetLatestPublishedNodeRevision,
  GetLatestPublishedNodeRevisionVariables
} from "../generated/graphql/GetLatestPublishedNodeRevision";
import {
  SetNodeAsVerified,
  SetNodeAsVerifiedVariables
} from "../generated/graphql/SetNodeAsVerified";
import { log } from "../utils/logger";

export const SET_NODE_AS_VERIFIED = gql`
  mutation SetNodeAsVerified($id: uuid!, $version: Int!) {
    update_node(
      where: { id: { _eq: $id } }
      _append: { content: { metadata: { verified: true } } }
      _set: { version: $version }
    ) {
      returning {
        id
      }
    }
  }
`;

export const GET_LATEST_PUBLISHED_NODE_REVISION = gql`
  query GetLatestPublishedNodeRevision($id: uuid!) {
    published: node_revision(
      where: { _and: { id: { _eq: $id }, status: { _eq: "published" } } }
      order_by: { version: desc }
      limit: 1
    ) {
      id
      created_at
      updated_at
      title
      content
      language
      status
      version
      type
    }
  }
`;

const FETCH_TIMEOUT_MS = 10000;

// tslint:disable-next-line: no-any
const fetchApi = (nodeFetch as any) as typeof fetch;

// tslint:disable-next-line:no-object-mutation no-any
(global as any).AbortController = AbortController;

const abortableFetch = AbortableFetch(fetchApi);

// TODO: refactor
// tslint:disable-next-line: cognitive-complexity
export function LinkVerifierProcessor(queueClient: Bull.Queue): void {
  queueClient.process("link-verifier", async job => {
    log.info(
      "** link-verifier processing job=%s (attempt=%d)",
      job.id,
      job.attemptsMade
    );

    // try to decode event payload
    const errorOrPayload = WebhookPayload.decode(JSON.parse(job.data));
    if (isLeft(errorOrPayload)) {
      log.error(
        "** link-verifier cannot decode data : %s",
        readableReport(errorOrPayload.value)
      );
      return;
    }

    // extract node info from payload
    const payload = errorOrPayload.value;
    const node = payload.event.data.new;
    if (!node) {
      log.error(
        "** link-verifier no node found for payload: %s",
        JSON.stringify(payload)
      );
      return;
    }

    // get the latest published version for this node(id)
    // as it's useless to check the validity for previous revisions
    // (the node may be updated between verifier calls)
    const errorOrLatestPublishedNodeRevision = await GraphqlClient.query<
      GetLatestPublishedNodeRevision,
      GetLatestPublishedNodeRevisionVariables
    >({
      fetchPolicy: "no-cache",
      query: GET_LATEST_PUBLISHED_NODE_REVISION,
      variables: { id: node.id }
    });
    if (
      errorOrLatestPublishedNodeRevision.errors ||
      !errorOrLatestPublishedNodeRevision.data
    ) {
      log.error(
        `** link-verifier: cannot get lastest published revision for node ${node.id}: ${errorOrLatestPublishedNodeRevision.errors}`
      );
      throw new Error(
        `** link-verifier: cannot get lastest published revision for node ${node.id}`
      );
    }

    const publishedNode = errorOrLatestPublishedNodeRevision.data.published[0];
    log.debug(
      "** link-verifier processing node %s",
      JSON.stringify(publishedNode)
    );

    const url = publishedNode.content.values["website-url"];
    if (!url) {
      log.debug(
        "** link-verifier node %s has no website-url set",
        publishedNode.id
      );
      return;
    }

    log.info(
      "** link-verifier fetching (%s) for node %s (version=%d)",
      url,
      publishedNode.id,
      publishedNode.version
    );

    // request website page
    const { e1: responsePromise, e2: abortController } = abortableFetch(url);
    setTimeout(() => {
      abortController.abort();
    }, FETCH_TIMEOUT_MS);
    const res = await responsePromise;
    const body = await res.text();

    // check if the page contains node id
    if (body.indexOf(publishedNode.id) !== -1) {
      log.info(
        "** link-verifier found url at %s for node %s",
        url,
        publishedNode.id
      );

      // save "verified: true" into node metadata
      const errorOrSetNodeAsVerified = await GraphqlClient.mutate<
        SetNodeAsVerified,
        SetNodeAsVerifiedVariables
      >({
        mutation: SET_NODE_AS_VERIFIED,
        variables: {
          id: publishedNode.id,
          version: Number(publishedNode.version) + 1
        }
      });
      if (errorOrSetNodeAsVerified.errors || !errorOrSetNodeAsVerified.data) {
        log.error(
          `** link-verifier: cannot update node ${publishedNode.id} for ${url}: ${errorOrLatestPublishedNodeRevision.errors}`
        );
        throw new Error(
          `** link-verifier: cannot update node ${publishedNode.id} for ${url}`
        );
      }
    } else {
      log.info(
        "** link-verifier: id not found at %s for node %s",
        url,
        publishedNode.id
      );
      // schedule a retry
      throw new Error(
        `** link-verifier: cannot find id ${publishedNode.id} at ${url}`
      );
    }
  });
}
