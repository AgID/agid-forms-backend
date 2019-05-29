/**
 * This file contains methods for dealing with session tokens.
 */

import { sign } from "jsonwebtoken";

export const JwtService = (secret: string, expiresIn: string) => ({
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

export type JwtService = typeof JwtService;
