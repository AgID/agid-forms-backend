/**
 * This file contains methods for dealing with session tokens.
 */

import * as crypto from "crypto";

/**
 * Generates a new random token.
 */
export const generateNewToken = (): string => {
  // Use the crypto.randomBytes as token.
  const SESSION_TOKEN_LENGTH_BYTES = 48;
  return crypto.randomBytes(SESSION_TOKEN_LENGTH_BYTES).toString("hex");
};
