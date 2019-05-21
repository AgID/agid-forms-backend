/**
 * This controller handles reading the user profile from the
 * app by forwarding the call to the API system.
 */

import * as express from "express";
import { isLeft } from "fp-ts/lib/Either";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import { AppUser, extractUserFromRequest } from "../types/user";

export default class ProfileController {
  /**
   * Returns the profile for the user identified by the provided fiscal
   * code.
   */
  public async getProfile(
    req: express.Request
  ): Promise<IResponseSuccessJson<AppUser> | IResponseErrorInternal> {
    const errorOrUser = extractUserFromRequest(req);

    if (isLeft(errorOrUser)) {
      // Unable to extract the user from the request.
      const error = errorOrUser.value;
      return ResponseErrorInternal(error.message);
    }

    const profile = errorOrUser.value;
    return ResponseSuccessJson(profile);
  }
}
