/**
 * Builds and configure a Passport strategy to authenticate the proxy clients.
 */

import * as express from "express";
import { Either } from "fp-ts/lib/Either";
import * as passport from "passport-http-bearer";
import { IVerifyOptions } from "passport-http-bearer";
import { ISessionStorage } from "../services/ISessionStorage";
import { SessionToken } from "../types/token";
import { User } from "../types/user";

/**
 * Passthrough a bearer token for specified paths.
 */
const bearerTokenStrategy = (
  sessionStorage: ISessionStorage,
  paths: ReadonlyArray<string>
) => {
  const options = {
    passReqToCallback: true,
    realm: "Proxy API",
    scope: "request"
  };
  return new passport.Strategy(options, (
    req: express.Request,
    token: string,
    // tslint:disable-next-line:no-any
    done: (error: any, user?: any, options?: IVerifyOptions | string) => void
  ) => {
    const path = req.route.path;

    if (-1 !== paths.indexOf(path)) {
      sessionStorage.getBySessionToken(token as SessionToken).then(
        (errorOrUser: Either<Error, User>) => {
          errorOrUser.fold(
            () => done(undefined, false),
            user => done(undefined, user)
          );
        },
        () => {
          done(undefined, false);
        }
      );
    } else {
      done(undefined, false);
    }
  });
};

export default bearerTokenStrategy;
