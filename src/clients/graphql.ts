import { InMemoryCache, NormalizedCacheObject } from "apollo-cache-inmemory";
import { ApolloClient } from "apollo-client";
import { HttpLink } from "apollo-link-http";
import {
  HASURA_GRAPHQL_ADMIN_SECRET,
  HASURA_GRAPHQL_ENDPOINT
} from "../config";

import { ApolloLink } from "apollo-link";
import gql from "graphql-tag";
import nodeFetch from "node-fetch";

const getHeaders = () => ({
  "X-Hasura-Admin-Secret": HASURA_GRAPHQL_ADMIN_SECRET
});

const cache = new InMemoryCache();
const adminHttpLink = new HttpLink({
  // tslint:disable-next-line: no-any
  fetch: (nodeFetch as any) as typeof fetch,
  headers: getHeaders(),
  uri: HASURA_GRAPHQL_ENDPOINT
});

const forwardingHttpLink = new HttpLink({
  // tslint:disable-next-line: no-any
  fetch: (nodeFetch as any) as typeof fetch,
  uri: HASURA_GRAPHQL_ENDPOINT
});

// tslint:disable-next-line: no-any
const isForwardingClient = (context: any) => {
  return context.clientName === "forwarding";
};

export const GraphqlClient = new ApolloClient({
  cache,
  link: ApolloLink.split(
    operation => isForwardingClient(operation.getContext()),
    forwardingHttpLink,
    adminHttpLink
  )
});

export type GraphqlClient = ApolloClient<NormalizedCacheObject>;

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
      on_conflict: { constraint: user_email_key, update_columns: [email] }
    ) {
      returning {
        id
        email
      }
    }
  }
`;

// tslint:disable-next-line: no-commented-code
// export const SEARCH_IPA = gql`
//   query SearchIpa($name: String!) {
//     search_ipa(args: { search: $name }) {
//       Comune
//       Provincia
//       Regione
//       cod_amm
//       des_amm
//     }
//   }
// `;

export const GET_RTD_FROM_IPA = gql`
  query GetPaFromIpa($code: String!) {
    ipa_pa(where: { cod_amm: { _eq: $code } }) {
      Comune
      Provincia
      Regione
      des_amm
      cod_amm
      tipologia_istat
      mail2
    }
    ipa_ou(
      where: {
        cod_amm: { _eq: $code }
        cod_ou: { _eq: "Ufficio_Transizione_Digitale" }
      }
    ) {
      cod_ou
      nome_resp
      cogn_resp
      mail_resp
    }
  }
`;

export const GET_USER_INFO = gql`
  query GetUserInfo($id: uuid!) {
    user(where: { id: { _eq: $id } }) {
      id
      email
    }
  }
`;

export const INSERT_NODE = gql`
  mutation InsertNode($node: node_insert_input!) {
    insert_node(objects: [$node]) {
      returning {
        id
        version
        user_id
      }
    }
  }
`;

export const UPDATE_NODE = gql`
  mutation UpdateNode($id: uuid!, $node: node_set_input!) {
    update_node(where: { id: { _eq: $id } }, _set: $node) {
      returning {
        id
        version
        user_id
      }
    }
  }
`;

export const DELETE_NODE = gql`
  mutation DeleteNode($id: uuid!) {
    delete_node(where: { id: { _eq: $id } }) {
      affected_rows
      returning {
        id
        version
        title
        user_id
      }
    }
  }
`;

export const NodeRevisionFragment = gql`
  fragment NodeRevisionFragment on node_revision {
    id
    title
    status
    content
    version
    user_id
    type
  }
`;

export const GET_NODE_REVISION = gql`
  query GetNodeRevision($id: uuid!, $version: Int!) {
    revision: node_revision(
      where: { _and: { id: { _eq: $id }, version: { _eq: $version } } }
      limit: 1
    ) {
      ...NodeRevisionFragment
    }
  }
  ${NodeRevisionFragment}
`;
