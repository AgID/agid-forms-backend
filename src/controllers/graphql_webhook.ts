import * as express from "express";
import * as t from "io-ts";
import * as RedisSMQ from "rsmq";

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "italia-ts-commons/lib/request_middleware";

import { DateFromString } from "italia-ts-commons/lib/dates";
import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { UUIDString } from "../generated/api/UUIDString";
import { RequiredHeaderValueMiddleware } from "../middlewares/required_header_value";

import { DecodeBodyMiddleware } from "../middlewares/decode_body";

const NodeT = t.interface({
  content: t.object,
  created_at: DateFromString,
  id: UUIDString,
  language: NonEmptyString,
  status: NonEmptyString,
  title: NonEmptyString,
  type: NonEmptyString,
  updated_at: DateFromString,
  user_id: UUIDString,
  version: NonNegativeInteger
});

const WebhookPayload = t.interface({
  created_at: DateFromString,
  delivery_info: t.interface({
    current_retry: NonNegativeInteger,
    max_retries: NonNegativeInteger
  }),
  event: t.interface({
    data: t.partial({
      new: NodeT,
      old: NodeT
    }),
    op: t.union([t.literal("UPDATE"), t.literal("INSERT")]),
    session_variables: t.partial({
      "x-hasura-role": NonEmptyString
    })
  }),
  id: UUIDString,
  table: t.interface({
    name: NonEmptyString,
    schema: NonEmptyString
  }),
  trigger: t.interface({
    name: NonEmptyString
  })
});
type WebhookPayload = t.TypeOf<typeof WebhookPayload>;

const WebhookResponse = t.interface({
  message: t.string
});
type WebhookResponse = t.TypeOf<typeof WebhookResponse>;

type GraphqlWebhookT = (
  receivedWebhookToken: string,
  payload: WebhookPayload
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<WebhookResponse>
>;

function GraphqlWebhookHandler(
  webhookToken: string,
  queueClient: RedisSMQ,
  queueName: string
): GraphqlWebhookT {
  return async (receivedWebhookToken: string, payload: WebhookPayload) => {
    if (receivedWebhookToken !== webhookToken) {
      return ResponseErrorForbiddenNotAuthorized;
    }

    // send event to queue
    const queues = await queueClient.listQueuesAsync();
    if (queues.indexOf(queueName) !== -1) {
      await queueClient.createQueueAsync({ qname: queueName });
    }
    const ret = await queueClient.sendMessageAsync({
      message: JSON.stringify(payload),
      qname: queueName
    });

    return ResponseSuccessJson({
      message: ret.toString()
    });
  };
}

export function GraphqlWebhook(
  receivedWebhookToken: string,
  queueClient: RedisSMQ,
  queueName: string
): express.RequestHandler {
  const handler = GraphqlWebhookHandler(
    receivedWebhookToken,
    queueClient,
    queueName
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredHeaderValueMiddleware("x-webhook-token"),
    DecodeBodyMiddleware(WebhookPayload)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
