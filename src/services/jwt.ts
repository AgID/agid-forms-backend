/**
 * This file contains methods for dealing with session tokens.
 */

import { sign } from "jsonwebtoken";
import { AppUser } from "../types/user";

export const HasuraJwtService = (secret: string, expiresIn: string) => ({
  /**
   * Generates a new JWT for a Drupal user's uid.
   */
  getJwtForUser: (
    name: string,
    userId: string,
    organizationId: string,
    roles: ReadonlyArray<string>,
    admin: boolean = false
  ): string => {
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
    return sign(user, Buffer.from(secret, "base64"), {
      expiresIn
    });
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
