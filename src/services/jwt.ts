/**
 * This file contains methods for dealing with session tokens.
 */

import { sign } from "jsonwebtoken";
import { UUIDString } from "../generated/api/UUIDString";
import { GraphqlToken } from "../types/token";
import { AppUser } from "../types/user";

const HASURA_AUTHENTICATED_ROLE = "authenticated";

export const HasuraJwtService = (secret: string, expiresInSeconds: number) => ({
  /**
   * Generates a new JWT for a Drupal user's uid.
   */
  getJwtForUser: (
    name: string,
    userId: UUIDString,
    groupId: string,
    roles: ReadonlyArray<string>,
  ): GraphqlToken => {
    const user = {
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": [HASURA_AUTHENTICATED_ROLE, ...roles],
        // if you want to use a different role for a graphql request
        // add a custom http header "x-hasura-role"
        // see https://docs.hasura.io/1.0/graphql/manual/auth/authentication/jwt.html#the-spec
        "x-hasura-default-role": HASURA_AUTHENTICATED_ROLE,
        "x-hasura-group-id": groupId,
        "x-hasura-user-id": userId
      },
      name
    };
    return sign(user, secret, {
      expiresIn: expiresInSeconds
    }) as GraphqlToken;
  }
});

export type HasuraJwtService = typeof HasuraJwtService;

///////////////////////////////////////////////////////

export const WebhookJwtService = (
  secret: string,
  expiresInSeconds: number
) => ({
  /**
   * Generates a new JWT for webhook.
   */
  getJwtForWebhook: (user: AppUser): string => {
    return sign(user, Buffer.from(secret, "base64"), {
      expiresIn: expiresInSeconds
    });
  }
});

export type WebhookJwtService = typeof WebhookJwtService;
