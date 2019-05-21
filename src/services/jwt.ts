/**
 * This file contains methods for dealing with session tokens.
 */

import { sign } from "jsonwebtoken";

export default class JwtService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string
  ) {}

  /**
   * Generates a new JWT for uid.
   */
  public getJwtForUid(uid: number): string {
    return sign(
      {
        drupal: {
          uid
        }
      },
      Buffer.from(this.secret, "base64"),
      // secret,
      {
        expiresIn: this.expiresIn
      }
    );
  }
}
