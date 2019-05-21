import * as t from "io-ts";
import {
  basicResponseDecoder,
  BasicResponseType,
  IPostApiRequestType
} from "italia-ts-commons/lib/requests";
import { AppUser } from "../types/user";

export type UserMetadataT = Record<string, string>;

export type UserWebhookT = IPostApiRequestType<
  {
    readonly user: AppUser;
    readonly webhookPath: string;
  },
  never,
  never,
  BasicResponseType<UserMetadataT>
>;

export const userWebhook: UserWebhookT = {
  body: params => JSON.stringify(params.user),
  headers: () => ({
    "Content-Type": "application/json"
  }),
  method: "post",
  query: () => ({}),
  response_decoder: basicResponseDecoder(t.record(t.string, t.string)),
  url: params => params.webhookPath
};
