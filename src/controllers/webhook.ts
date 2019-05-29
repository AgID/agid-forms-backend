import * as express from "express";
import * as t from "io-ts";

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import { CreateUserRequestT, JsonapiClient } from "../clients/jsonapi";
import { DrupalJwtService } from "../services/jwt";

import { isEmpty } from "fp-ts/lib/Array";
import { isLeft } from "fp-ts/lib/Either";
import { EmailString, NonEmptyString } from "italia-ts-commons/lib/strings";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "../middlewares/request_middleware";
import { UserFromRequestMiddleware } from "../middlewares/user_from_request";

import { log } from "../utils/logger";
import { UserMetadataT } from "../utils/webhooks";

const JwtUser = t.interface({
  email: EmailString,
  name: t.string
});
type JwtUser = t.TypeOf<typeof JwtUser>;

type AuthWebhookT = (
  user: JwtUser
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<UserMetadataT>
>;

function AuthWebhookHandler(
  drupalJwtService: ReturnType<DrupalJwtService>,
  jsonApiClient: ReturnType<JsonapiClient>,
  adminUid: number,
  defaultRoleId: string
): AuthWebhookT {
  return async user => {
    // Get admin JWT
    const jwt = drupalJwtService.getJwtForUid(adminUid);

    // Get Drupal user uid if exists
    const errorOrGetUserResponse = await jsonApiClient.getUser({
      jwt,
      username: user.name
    });

    log.debug(
      "AuthWebhookHandler|User response from jsonapi (%s)",
      JSON.stringify(errorOrGetUserResponse)
    );

    if (
      isLeft(errorOrGetUserResponse) ||
      errorOrGetUserResponse.value.status !== 200
    ) {
      log.error(
        "AuthWebhookHandler|Cannot get user from json api: %s",
        JSON.stringify(errorOrGetUserResponse.value)
      );
      return ResponseErrorInternal("Cannot get user from json api.");
    }

    const isExistingUser = !isEmpty(errorOrGetUserResponse.value.value.data);

    if (isExistingUser) {
      return ResponseSuccessJson({
        uid: errorOrGetUserResponse.value.value.data[0].attributes.drupal_internal__uid.toString()
      });
    }

    // Create Drupal user if not exists
    const drupalUser: CreateUserRequestT = {
      data: {
        attributes: {
          mail: user.email,
          name: user.name,
          status: true
        },
        relationships: {
          roles: {
            data: [
              {
                // TODO: remove this cast
                id: defaultRoleId as NonEmptyString,
                type: "user_role--user_role"
              }
            ]
          }
        },
        type: "user--user"
      }
    };

    log.debug("Creating new user (%s)", JSON.stringify(drupalUser));

    const errorOrCreateUserResponse = await jsonApiClient.createUser({
      drupalUser,
      jwt
    });

    if (
      isLeft(errorOrCreateUserResponse) ||
      errorOrCreateUserResponse.value.status !== 201
    ) {
      log.error(
        "Cannot post user to json api: %s",
        JSON.stringify(errorOrCreateUserResponse)
      );
      return ResponseErrorInternal("Cannot post user to json api.");
    }
    return ResponseSuccessJson({
      uid: errorOrCreateUserResponse.value.value.data.attributes.drupal_internal__uid.toString()
    });
  };
}

export function AuthWebhook(
  drupalJwtService: ReturnType<DrupalJwtService>,
  jsonApiClient: ReturnType<JsonapiClient>,
  adminUid: number,
  defaultRoleId: string
): express.RequestHandler {
  const handler = AuthWebhookHandler(
    drupalJwtService,
    jsonApiClient,
    adminUid,
    defaultRoleId
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    UserFromRequestMiddleware(JwtUser)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
