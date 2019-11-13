import {
  fromEither,
  left2v,
  right2v,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { GraphqlClient, UPSERT_USER } from "../clients/graphql";
import { UUIDString } from "../generated/api/UUIDString";
import {
  group_constraint,
  group_update_column,
  role_constraint,
  role_update_column,
  user_group_constraint
} from "../generated/graphql/globalTypes";

import {
  UpsertUser,
  UpsertUserVariables
} from "../generated/graphql/UpsertUser";
import { HasuraJwtService } from "../services/jwt";
import { AppUser } from "../types/user";

export function GetOrCreateUser(
  graphqlClient: GraphqlClient,
  hasuraJwtService: ReturnType<HasuraJwtService>,
  user: AppUser
): TaskEither<Error, Record<string, string>> {
  // Upsert user into graphql database
  return tryCatch(
    () =>
      graphqlClient.mutate<UpsertUser, UpsertUserVariables>({
        mutation: UPSERT_USER,
        variables: {
          user: {
            email: user.email,
            metadata: user.metadata,
            user_groups: {
              data: user.roles.map(role => ({
                user_group_group: {
                  data: {
                    // assumes user.name = cod_amm
                    group: user.group
                  },
                  on_conflict: {
                    constraint: group_constraint.groups_pkey,
                    update_columns: [group_update_column.group]
                  }
                },
                user_group_role: {
                  data: {
                    role
                  },
                  on_conflict: {
                    constraint: role_constraint.role_pkey,
                    update_columns: [role_update_column.role]
                  }
                }
              })),
              on_conflict: {
                constraint: user_group_constraint.user_group_pkey,
                update_columns: []
              }
            }
          }
        }
      }),
    error => error as Error
  )
    .chain(data =>
      data.errors
        ? left2v(Error(data.errors.join("\n")))
        : !data.data
        ? left2v(Error("Cannot upsert user."))
        : !data.data.insert_user || !data.data.insert_user.returning
        ? left2v(Error("Cannot get data from upserted user."))
        : right2v(data.data.insert_user.returning[0])
    )
    .chain(upsertedUser =>
      fromEither(
        UUIDString.decode(upsertedUser.id)
          .mapLeft(() => Error("Cannot get UUID from upserted user."))
          .map(userUuid => ({
            id: userUuid,
            jwt: hasuraJwtService.getJwtForUser(
              user.email,
              userUuid,
              user.group,
              user.roles
            )
          }))
      )
    );
}
