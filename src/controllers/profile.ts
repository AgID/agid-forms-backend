import * as express from "express";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "italia-ts-commons/lib/request_middleware";
import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { EmailString } from "italia-ts-commons/lib/strings";
import { GET_USER_INFO, GraphqlClient } from "../clients/graphql";
import { UserProfile } from "../generated/api/UserProfile";
import {
  GetUserInfo,
  GetUserInfoVariables
} from "../generated/graphql/GetUserInfo";
import { UserFromRequestMiddleware } from "../middlewares/user_from_request";
import { AppUser } from "../types/user";

type IGetProfile = (
  user: AppUser
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorInternal
  | IResponseSuccessJson<UserProfile>
>;

export function GetProfileHandler(graphqlClient: GraphqlClient): IGetProfile {
  return async (user: AppUser) => {
    if (!user.metadata || !user.metadata.id) {
      return ResponseErrorValidation(
        "Empty id.",
        "Cannot found an id for this user."
      );
    }
    const errorOrUserInfo = await graphqlClient.query<
      GetUserInfo,
      GetUserInfoVariables
    >({
      query: GET_USER_INFO,
      variables: {
        id: user.metadata.id
      }
    });
    if (errorOrUserInfo.errors) {
      return ResponseErrorInternal(errorOrUserInfo.errors.join("\n"));
    }
    if (
      !errorOrUserInfo.data ||
      !errorOrUserInfo.data.user ||
      !errorOrUserInfo.data.user[0]
    ) {
      return ResponseErrorNotFound(
        "User not found.",
        "No matching user for the provided id."
      );
    }
    const userInfo = errorOrUserInfo.data.user[0];
    return ResponseSuccessJson({
      email: userInfo.email as EmailString,
      id: userInfo.id
    });
  };
}

export function GetProfile(
  graphqlClient: GraphqlClient
): express.RequestHandler {
  const handler = GetProfileHandler(graphqlClient);
  const withrequestMiddlewares = withRequestMiddlewares(
    UserFromRequestMiddleware(AppUser)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
