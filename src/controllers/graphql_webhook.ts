import * as express from "express";
import * as t from "io-ts";

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
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

import { RedisClient } from "redis";
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

export const WebhookPayload = t.interface({
  created_at: DateFromString,
  delivery_info: t.interface({
    current_retry: NonNegativeInteger,
    max_retries: NonNegativeInteger
  }),
  event: t.interface({
    data: t.partial({
      new: NodeT,
      old: t.union([NodeT, t.null])
    }),
    op: t.union([
      t.literal("UPDATE"),
      t.literal("INSERT"),
      t.literal("DELETE")
    ]),
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
export type WebhookPayload = t.TypeOf<typeof WebhookPayload>;

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
  redisClient: RedisClient,
  channelName: string
): GraphqlWebhookT {
  return (receivedWebhookToken: string, payload: WebhookPayload) => {
    return new Promise(resolve => {
      if (receivedWebhookToken !== webhookToken) {
        return resolve(ResponseErrorForbiddenNotAuthorized);
      }
      // publish event to channel
      // beware: the event won't be persisted so any failing attempt to catch it
      // will be discarded (ie. when a subscriber starts after the publish action)
      redisClient.publish(channelName, JSON.stringify(payload), (err, ret) => {
        return resolve(
          err
            ? ResponseErrorInternal(`Error publishing event: ${err}`)
            : ResponseSuccessJson({
                message: ret.toString()
              })
        );
      });
    });
  };
}

export function GraphqlWebhook(
  receivedWebhookToken: string,
  redisClient: RedisClient,
  channelName: string
): express.RequestHandler {
  const handler = GraphqlWebhookHandler(
    receivedWebhookToken,
    redisClient,
    channelName
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredHeaderValueMiddleware("x-webhook-token"),
    DecodeBodyMiddleware(WebhookPayload)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
