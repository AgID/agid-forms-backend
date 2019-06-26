import * as express from "express";
import * as t from "io-ts";

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

import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { UUIDString } from "../generated/api/UUIDString";
import { RequiredHeaderValueMiddleware } from "../middlewares/required_header_value";

import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { DecodeBodyMiddleware } from "../middlewares/decode_body";

const NodeT = t.interface({
  content: t.object,
  created_at: UTCISODateFromString,
  id: UUIDString,
  language: NonEmptyString,
  status: NonEmptyString,
  title: NonEmptyString,
  type: NonEmptyString,
  updated_at: UTCISODateFromString,
  user_id: UUIDString,
  version: NonNegativeInteger
});

// tslint:disable-next-line: no-commented-code
const WebhookPayload = t.interface({
  event: t.interface({
    created_at: UTCISODateFromString,
    data: t.partial({
      new: NodeT,
      old: NodeT
    }),
    delivery_info: t.interface({
      current_retry: NonNegativeInteger,
      max_retries: NonNegativeInteger
    }),
    id: UUIDString,
    op: t.union([t.literal("UPDATE"), t.literal("INSERT")]),
    session_variables: t.partial({
      "x-hasura-role": NonEmptyString
    }),
    table: t.interface({
      name: NonEmptyString,
      schema: NonEmptyString
    }),
    trigger: t.interface({
      name: NonEmptyString
    })
  })
});
type WebhookPayload = t.TypeOf<typeof WebhookPayload>;

const WebhookResponse = t.interface({
  message: t.string
});
type WebhookResponse = t.TypeOf<typeof WebhookResponse>;

type GraphqlWebhookT = (
  receivedWebhookToken: string
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<WebhookResponse>
>;

function GraphqlWebhookHandler(webhookToken: string): GraphqlWebhookT {
  return async (receivedWebhookToken: string) => {
    if (receivedWebhookToken !== webhookToken) {
      return ResponseErrorForbiddenNotAuthorized;
    }
    return ResponseSuccessJson({
      message: "processing"
    });
  };
}

export function GraphqlWebhook(
  receivedWebhookToken: string
): express.RequestHandler {
  const handler = GraphqlWebhookHandler(receivedWebhookToken);
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredHeaderValueMiddleware("x-webhook-token"),
    DecodeBodyMiddleware(WebhookPayload)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
