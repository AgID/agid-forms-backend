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

import { RequiredHeaderValueMiddleware } from "../middlewares/required_header_value";

// tslint:disable-next-line: no-commented-code
// const WebhookPayload = t.interface({});
// type WebhookPayload = t.TypeOf<typeof WebhookPayload>;

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
    RequiredHeaderValueMiddleware("x-webhook-token")
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
