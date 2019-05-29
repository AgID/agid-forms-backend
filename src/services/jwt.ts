/**
 * This file contains methods for dealing with session tokens.
 */

import { sign } from "jsonwebtoken";
import { AppUser } from "../types/user";

export const DrupalJwtService = (secret: string, expiresIn: string) => ({
  /**
   * Generates a new JWT for a Drupal user's uid.
   */
  getJwtForUid: (uid: number): string => {
    return sign(
      {
        drupal: {
          uid
        }
      },
      Buffer.from(secret, "base64"),
      {
        expiresIn
      }
    );
  }
});

export type DrupalJwtService = typeof DrupalJwtService;

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
