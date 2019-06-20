/**
 * This file contains methods for dealing with session tokens.
 */

import { sign } from "jsonwebtoken";
import { UUIDString } from "../generated/api/UUIDString";
import { GraphqlToken } from "../types/token";
import { AppUser } from "../types/user";

export const HasuraJwtService = (secret: string, expiresIn: string) => ({
  /**
   * Generates a new JWT for a Drupal user's uid.
   */
  getJwtForUser: (
    name: string,
    userId: UUIDString,
    organizationId: string,
    roles: ReadonlyArray<string>,
    admin: boolean = false
  ): GraphqlToken => {
    const user = {
      admin,
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": roles,
        "x-hasura-default-role": roles[0],
        "x-hasura-org-id": organizationId,
        "x-hasura-user-id": userId
      },
      name
    };
    return sign(user, secret, {
      expiresIn
    }) as GraphqlToken;
  }
});

export type HasuraJwtService = typeof HasuraJwtService;

///////////////////////////////////////////////////////

export const WebhookJwtService = (secret: string, expiresIn: string) => ({
  /**
   * Generates a new JWT for webhook.
   */
  getJwtForWebhook: (user: AppUser): string => {
    return sign(user, Buffer.from(secret, "base64"), {
      expiresIn
    });
  }
});

export type WebhookJwtService = typeof WebhookJwtService;
