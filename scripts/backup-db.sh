#!/bin/bash

DUMP_FILE_NAME="agid-forms-backup-`date +%Y-%m-%d-%H-%M`.dump"
echo "Creating dump: $DUMP_FILE_NAME"

export PGHOST=postgresql
export PGUSER=postgres

export PGDATABASE=$POSTGRESQL_DATABASE
export PGPASSWORD=$POSTGRESQL_PASSWORD

cd /db-backups

pg_dump -w --format=c --blobs > $DUMP_FILE_NAME

if [ $? -ne 0 ]; then
  rm $DUMP_FILE_NAME
  echo "Back up not created, check db connection settings"
  exit 1
else
  find . -name "*.dump" -type f -mtime +90 -exec rm -f {} \;
fi

echo 'Successfully Backed Up'
exit 0
