import * as t from "io-ts";
import {
  basicResponseDecoder,
  BasicResponseType,
  IPostApiRequestType
} from "italia-ts-commons/lib/requests";

export type UserMetadataT = Record<string, string>;

export type UserWebhookT = IPostApiRequestType<
  {
    readonly webhookPath: string;
    readonly jwt: string;
  },
  "Authorization" | "Content-Type",
  never,
  BasicResponseType<UserMetadataT>
>;

export const userWebhook: UserWebhookT = {
  body: params => JSON.stringify({ jwt: params.jwt }),
  headers: params => ({
    Authorization: `Bearer ${params.jwt}`,
    "Content-Type": "application/json"
  }),
  method: "post",
  query: () => ({}),
  response_decoder: basicResponseDecoder(t.record(t.string, t.string)),
  url: params => params.webhookPath
};
