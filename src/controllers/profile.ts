/**
 * This controller handles reading the user profile from the
 * app by forwarding the call to the API system.
 */

import * as express from "express";

import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import { AppUser, withUserFromRequest } from "../types/user";

export default class ProfileController {
  /**
   * Returns the profile for the user identified by the provided fiscal
   * code.
   */
  public readonly getProfile = (
    req: express.Request
  ): Promise<
    | IResponseSuccessJson<AppUser>
    | IResponseErrorInternal
    | IResponseErrorValidation
  > => withUserFromRequest(req, async user => ResponseSuccessJson(user));
}
