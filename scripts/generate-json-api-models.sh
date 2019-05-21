#!/usr/bin/env bash

docker run --rm -v //$PWD://usr/src/app -e "NODE_ENV=development" -w //usr/src/app spid-proxy/tools:1.0.0 yarn generate:jsonapi:api-models
