import * as express from "express";

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "../middlewares/request_middleware";
import { UserFromRequestMiddleware } from "../middlewares/user_from_request";

import { AppUser } from "../types/user";

import { UserMetadataT } from "../utils/webhooks";

type AuthWebhookT = (
  user: AppUser
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<UserMetadataT>
>;

function AuthWebhookHandler(
  // graphqlClient: ReturnType<GraphqlClient>,
  // defaultRoleId: string,
  // adminSecret: string
): AuthWebhookT {
  return async user => {
    // TODO: set X-Hasura-Admin-Secret in graphql call

    // TODO: upsert user into database
    return ResponseSuccessJson({
      ok: "OK"
    });
  };
}

export function AuthWebhook(
  // graphqlClient: ReturnType<GraphqlClient>,
  defaultRoleId: string,
  adminSecret: string
): express.RequestHandler {
  const handler = AuthWebhookHandler(/*graphqlClient, defaultRoleId, adminSecret*/);
  const withrequestMiddlewares = withRequestMiddlewares(
    UserFromRequestMiddleware(AppUser)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
