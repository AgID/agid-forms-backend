import { GET_USER_INFO, GraphqlClient } from "../clients/graphql";

import {
  GetUserInfo,
  GetUserInfoVariables
} from "../generated/graphql/GetUserInfo";

import { WebhookPayload } from "../controllers/graphql_webhook";
import { log } from "../utils/logger";

type StatusT = "draft" | "needs_review" | "published" | "archived";
type NodeTypeT = "dichiarazione_accessibilita" | "segnalazione_accessibilita";

export const transitionedTo = (
  payload: WebhookPayload,
  to: StatusT,
  from?: StatusT
) => {
  const newContent = payload.event.data.new;
  const oldContent = payload.event.data.old;
  return (
    oldContent &&
    newContent &&
    (from ? oldContent.status === from : oldContent.status !== to) &&
    newContent.status === to
  );
};

export const isNodeOfType = (payload: WebhookPayload, type: NodeTypeT) => {
  const newContent = payload.event.data.new;
  return newContent && newContent.type === type;
};

export const getUserInfo = async (
  userId: string
): Promise<GetUserInfo | undefined> => {
  const errorOrUserInfo = await GraphqlClient.query<
    GetUserInfo,
    GetUserInfoVariables
  >({
    fetchPolicy: "no-cache",
    query: GET_USER_INFO,
    variables: {
      id: userId
    }
  });
  if (errorOrUserInfo.errors) {
    log.error(errorOrUserInfo.errors.join("\n"));
    return;
  }
  return errorOrUserInfo.data;
};
