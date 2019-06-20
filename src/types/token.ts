import * as t from "io-ts";
import { tag } from "italia-ts-commons/lib/types";

interface ISessionTokenTag {
  readonly kind: "SessionToken";
}
export const SessionToken = tag<ISessionTokenTag>()(t.string);
export type SessionToken = t.TypeOf<typeof SessionToken>;

interface IGraphqlTokenTag {
  readonly kind: "GraphqlToken";
}
export const GraphqlToken = tag<IGraphqlTokenTag>()(t.string);
export type GraphqlToken = t.TypeOf<typeof GraphqlToken>;
