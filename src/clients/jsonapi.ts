import * as t from "io-ts";
import {
  basicResponseDecoder,
  BasicResponseType,
  composeResponseDecoders,
  createFetchRequestForApi,
  IGetApiRequestType,
  ioResponseDecoder,
  IPostApiRequestType,
  IResponseType,
  ResponseDecoder,
  TypeofApiCall
} from "italia-ts-commons/lib/requests";

import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";
import nodeFetch from "node-fetch";

const CreateUserRequestT = t.interface({
  data: t.interface({
    attributes: t.interface({
      mail: EmailString,
      name: FiscalCode,
      status: t.boolean
    }),
    relationships: t.interface({
      roles: t.interface({
        data: t.array(
          t.interface({
            id: NonEmptyString,
            type: t.literal("user_role--user_role")
          })
        )
      })
    }),
    type: t.literal("user--user")
  })
});
export type CreateUserRequestT = t.TypeOf<typeof CreateUserRequestT>;

const UserResponseT = t.interface({
  attributes: t.interface({
    drupal_internal__uid: t.number,
    mail: EmailString,
    name: NonEmptyString
  })
});

const GetUserResponseT = t.interface({
  data: t.array(UserResponseT)
});
type GetUserResponseT = t.TypeOf<typeof GetUserResponseT>;

const CreateUserResponseT = t.interface({
  data: UserResponseT
});
type CreateUserResponseT = t.TypeOf<typeof CreateUserResponseT>;

type GetUserT = IGetApiRequestType<
  {
    readonly username: FiscalCode;
    readonly jwt: string;
  },
  never,
  never,
  BasicResponseType<GetUserResponseT>
>;

export type BasicResponseTypeWith201<R> =
  | BasicResponseType<R>
  | IResponseType<201, R>;

type CreateUserT = IPostApiRequestType<
  {
    readonly drupalUser: CreateUserRequestT;
    readonly jwt: string;
  },
  never,
  never,
  BasicResponseTypeWith201<CreateUserResponseT>
>;

export function basicResponseDecoderWith201<R, O = R>(
  type: t.Type<R, O>
): ResponseDecoder<BasicResponseTypeWith201<R>> {
  return composeResponseDecoders(
    basicResponseDecoder(type),
    ioResponseDecoder(201, type)
  );
}

const jsonApiHeaders = (jwt: string) => ({
  Accept: "application/vnd.api+json",
  Authorization: `Bearer ${jwt}`,
  "Content-Type": "application/vnd.api+json"
});

export function JsonapiClient(
  baseUrl?: string,
  // tslint:disable-next-line:no-any
  fetchApi: typeof fetch = (nodeFetch as any) as typeof fetch
): {
  readonly getUser: TypeofApiCall<GetUserT>;
  readonly createUser: TypeofApiCall<CreateUserT>;
} {
  const options = {
    baseUrl,
    fetchApi
  };

  const getUser: GetUserT = {
    headers: params => jsonApiHeaders(params.jwt),
    method: "get",
    query: params => ({
      "filter[name]": params.username
    }),
    response_decoder: basicResponseDecoder(GetUserResponseT),
    url: () => `/user/user`
  };

  const createUser: CreateUserT = {
    body: params => JSON.stringify(params.drupalUser),
    headers: params => jsonApiHeaders(params.jwt),
    method: "post",
    query: () => ({}),
    response_decoder: basicResponseDecoderWith201(CreateUserResponseT),
    url: () => `/user/user`
  };

  return {
    createUser: createFetchRequestForApi(createUser, options),
    getUser: createFetchRequestForApi(getUser, options)
  };
}

export type JsonapiClient = typeof JsonapiClient;
