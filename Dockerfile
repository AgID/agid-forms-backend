FROM circleci/node:10.18.1 as builder

ARG HASURA_GRAPHQL_ENDPOINT
ARG HASURA_GRAPHQL_ADMIN_SECRET

RUN sudo apt-get -y install --no-install-recommends libunwind8

WORKDIR /usr/src/app

COPY /yarn.lock /usr/src/app/yarn.lock
COPY /package.json /usr/src/app/package.json
RUN sudo chmod -R 777 /usr/src/app
RUN yarn install

COPY /src /usr/src/app/src
# COPY /patches /usr/src/app/patches
COPY /tsconfig.json /usr/src/app/tsconfig.json
COPY /api_backend.yaml /usr/src/app/api_backend.yaml
COPY /gulpfile.js /usr/src/app/gulpfile.js
COPY /apollo.config.js /usr/src/app/apollo.config.js

RUN sudo chmod -R 777 /usr/src/app/src
RUN yarn generate && yarn build

FROM node:10.18.1-alpine
LABEL maintainer="https://www.agid.gov.it"

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules

COPY /package.json /usr/src/app/package.json
COPY /public /usr/src/app/public

COPY --from=builder /usr/src/app/src /usr/src/app/src

EXPOSE 80

CMD ["yarn", "start"]
