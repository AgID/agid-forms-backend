import express = require("express");
import { fromNullable } from "fp-ts/lib/Option";
import passport = require("passport");
import AuthenticationController from "../controllers/authentication";
import { log } from "../utils/logger";
import getErrorCodeFromResponse from "./getErrorCodeFromResponse";

/**
 * Catch SPID authentication errors and redirect the client to
 * clientErrorRedirectionUrl.
 */
export function withSpidAuth(
  controller: AuthenticationController,
  clientErrorRedirectionUrl: string,
  clientLoginRedirectionUrl: string
): (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => void {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    passport.authenticate("spid", async (err, user) => {
      if (err) {
        log.error("Error in SPID authentication: %s", err);
        return res.redirect(
          clientErrorRedirectionUrl +
            fromNullable(err.statusXml)
              .chain(statusXml => getErrorCodeFromResponse(statusXml))
              .map(errorCode => `?errorCode=${errorCode}`)
              .getOrElse("")
        );
      }
      if (!user) {
        log.error("Error in SPID authentication: no user found");
        return res.redirect(clientLoginRedirectionUrl);
      }
      const response = await controller.acs(user);
      response.apply(res);
    })(req, res, next);
  };
}
