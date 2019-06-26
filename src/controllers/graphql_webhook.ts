import * as express from "express";
import * as t from "io-ts";

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "italia-ts-commons/lib/request_middleware";

import { RequiredHeaderValueMiddleware } from "../middlewares/required_header_value";

const WebhookResponse = t.interface({
  message: t.string
});
type WebhookResponse = t.TypeOf<typeof WebhookResponse>;

type GraphqlWebhookT = (
  webhookToken: string
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<WebhookResponse>
>;

function GraphqlWebhookHandler(webhookToken: string): GraphqlWebhookT {
  return async () => {
    return ResponseSuccessJson({
      message: webhookToken
    });
  };
}

export function GraphqlWebhook(webhookToken: string): express.RequestHandler {
  const handler = GraphqlWebhookHandler(webhookToken);
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredHeaderValueMiddleware("X-Webhook-token")
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
