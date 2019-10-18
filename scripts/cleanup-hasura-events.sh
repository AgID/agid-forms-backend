#!/bin/bash

# see https://docs.hasura.io/1.0/graphql/manual/event-triggers/clean-up.html

export PGPASSWORD=$POSTGRESQL_PASSWORD

psql --host postgresql -U postgres -d $POSTGRESQL_DATABASE -p 5432 \
  -c "DELETE FROM hdb_catalog.event_invocation_logs;
      DELETE FROM hdb_catalog.event_log
      WHERE delivered = true OR error = true;"
