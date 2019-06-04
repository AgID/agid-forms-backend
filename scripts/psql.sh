#!/bin/bash

export POSTGRES_DB_NAME="agid"

export POSTGRES_PASSWORD=$(kubectl get secret --namespace default backend-secrets -o jsonpath="{.data.postgresql-password}" | base64 --decode)

kubectl run postgresql-postgresql-client --rm --tty -i --restart='Never' --namespace default --image docker.io/bitnami/postgresql:11.3.0 \
  --env="PGPASSWORD=$POSTGRES_PASSWORD" --command -- psql --host postgresql-postgresql -U postgres -d $POSTGRES_DB_NAME -p 5432

# kubectl port-forward --namespace default svc/postgresql-postgresql 5432:5432

# PGPASSWORD="$POSTGRES_PASSWORD" psql --host 127.0.0.1 -U postgres -d $POSTGRES_DB_NAME -p 5432

# docker run -it --rm -e PGPASSWORD=$POSTGRES_PASSWORD  postgres psql -h docker.for.win.localhost -U postgres -d agid

# docker run -p 80:80 -e "PGADMIN_DEFAULT_EMAIL=user@domain.com" -e "PGADMIN_DEFAULT_PASSWORD=SuperSecret" dpage/pgadmin4
