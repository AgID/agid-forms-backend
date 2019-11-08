import * as express from "express";
import { isLeft } from "fp-ts/lib/Either";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "italia-ts-commons/lib/request_middleware";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { SuccessResponse } from "../generated/api/SuccessResponse";
import { UserFromRequestMiddleware } from "../middlewares/user_from_request";
import { IObjectStorage } from "../services/object_storage";
import { SessionToken } from "../types/token";
import { AppUser } from "../types/user";

type ILogout = (
  user: AppUser
) => Promise<IResponseErrorInternal | IResponseSuccessJson<SuccessResponse>>;

export function LogoutHandler(
  sessionStorage: IObjectStorage<AppUser, SessionToken>
): ILogout {
  return async user => {
    // Delete user session
    const errorOrSession = await sessionStorage.del(user.session_token);
    if (isLeft(errorOrSession) || !errorOrSession.value) {
      return ResponseErrorInternal("Cannot delete user session");
    }
    return ResponseSuccessJson({ message: "logout" });
  };
}

export function Logout(
  sessionStorage: IObjectStorage<AppUser, SessionToken>
): express.RequestHandler {
  const handler = LogoutHandler(sessionStorage);
  const withrequestMiddlewares = withRequestMiddlewares(
    UserFromRequestMiddleware(AppUser)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
