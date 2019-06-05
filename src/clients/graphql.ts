import { InMemoryCache } from "apollo-cache-inmemory";
import { ApolloClient } from "apollo-client";
import { HttpLink } from "apollo-link-http";
import {
  HASURA_GRAPHQL_ADMIN_SECRET,
  HASURA_GRAPHQL_ENDPOINT
} from "../config";

import gql from "graphql-tag";
import nodeFetch from "node-fetch";

const getHeaders = () => ({
  "X-Hasura-Admin-Secret": HASURA_GRAPHQL_ADMIN_SECRET
});

const cache = new InMemoryCache();
const link = new HttpLink({
  // tslint:disable-next-line: no-any
  fetch: (nodeFetch as any) as typeof fetch,
  headers: getHeaders(),
  uri: HASURA_GRAPHQL_ENDPOINT
});

export const GraphqlClient = new ApolloClient({
  cache,
  link
});

export type GraphqlClient = typeof GraphqlClient;

/////////// QUERIES

// tslint:disable-next-line: no-commented-code
//
// __EXAMPLE__:
//
// GraphqlClient.mutate<UpsertUser, UpsertUserVariables>({
//   mutation: UPSERT_USER,
//   variables: {
//     user: {
//       id: "foo",
//       email: "foo@email"
//     }
//   }
// })
//   .then(data => {
//     const r = data.data;
//     if (r) {
//       console.log(JSON.stringify(r.insert_user!.returning[0].email));
//     }
//   })
//   .catch(err => console.error(err));

export const UPSERT_USER = gql`
  mutation UpsertUser($user: user_insert_input!) {
    insert_user(
      objects: [$user]
      on_conflict: { constraint: user_pkey, update_columns: [email] }
    ) {
      returning {
        id
        email
      }
    }
  }
`;
