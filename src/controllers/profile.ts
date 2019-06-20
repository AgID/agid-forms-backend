import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { GraphqlClient } from "../clients/graphql";
import { UserProfile } from "../generated/api/UserProfile";
import { UUIDString } from "../generated/api/UUIDString";

type IGetProfile = (
  userId: UUIDString
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorInternal
  | IResponseSuccessJson<UserProfile>
>;

export function GetProfile(graphqlClient: GraphqlClient): IGetProfile {
  return async (userId: UUIDString) => {

    const errorOrUserInfo = await graphqlClient.query<
      ,
      GraphqlGetPaFromIpaVariables
    >({
      query: GET_RTD_FROM_IPA,
      variables: {
        code: ipaCode
      }
    });
    

  };
}
