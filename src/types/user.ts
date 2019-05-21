import * as express from "express";
import * as t from "io-ts";
import { IResponseErrorValidation } from "italia-ts-commons/lib/responses";

import { withValidatedOrValidationError } from "../utils/responses";
import { SessionToken } from "./token";

export const AppUser = t.intersection([
  t.interface({
    created_at: t.number,
    name: t.string,
    session_token: SessionToken
  }),
  t.partial({
    metadata: t.record(t.string, t.string),
    sessionIndex: t.string
  })
]);

export type AppUser = t.TypeOf<typeof AppUser>;

export const withUserFromRequest = async <T>(
  req: express.Request,
  f: (user: AppUser) => Promise<T>
): Promise<IResponseErrorValidation | T> =>
  withValidatedOrValidationError(AppUser.decode(req.user), f);
