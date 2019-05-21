import * as express from "express";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import { CreateUserRequestT, JsonapiClient } from "../clients/jsonapi";
import JwtService from "../services/jwt";

import { isEmpty } from "fp-ts/lib/Array";
import { isLeft } from "fp-ts/lib/Either";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { AppUser } from "../types/user";
import { log } from "../utils/logger";
import { UserMetadataT } from "../utils/webhooks";

export default class WebhookController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly jsonApiClient: ReturnType<JsonapiClient>,
    private readonly adminUid: number,
    private readonly defaultRoleId: string
  ) {}
  public async getUserMetadata(
    req: express.Request
  ): Promise<IResponseSuccessJson<UserMetadataT> | IResponseErrorInternal> {
    const errorOrUser = AppUser.decode(req.body);

    if (isLeft(errorOrUser)) {
      log.error(
        "Cannot extract user from request body: %s",
        JSON.stringify(req.body)
      );
      return ResponseErrorInternal("Cannot extract user from request body");
    }

    const user = errorOrUser.value;

    // Get admin JWT
    const jwt = this.jwtService.getJwtForUid(this.adminUid);

    // Get Drupal user uid if exists
    const errorOrGetUserResponse = await this.jsonApiClient.getUser({
      jwt,
      username: user.fiscal_code
    });

    log.debug(
      "**** User response from jsonapi (%s)",
      JSON.stringify(errorOrGetUserResponse)
    );

    if (
      isLeft(errorOrGetUserResponse) ||
      errorOrGetUserResponse.value.status !== 200
    ) {
      log.error(
        "Cannot get user from json api: %s",
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

    const drupalUser: CreateUserRequestT = {
      data: {
        attributes: {
          mail: user.spid_email,
          name: user.fiscal_code,
          status: true
        },
        relationships: {
          roles: {
            data: [
              {
                // TODO: remove this cast
                id: this.defaultRoleId as NonEmptyString,
                type: "user_role--user_role"
              }
            ]
          }
        },
        type: "user--user"
      }
    };
    log.debug("Creating new user (%s)", JSON.stringify(drupalUser));
    const errorOrCreateUserResponse = await this.jsonApiClient.createUser({
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
  }
}
