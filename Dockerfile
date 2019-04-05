FROM circleci/node:8.11.3 as builder

RUN sudo apt-get -y install --no-install-recommends libunwind8=1.1-3.2

WORKDIR /usr/src/app

COPY /src /usr/src/app/src
COPY /patches /usr/src/app/patches
COPY /package.json /usr/src/app/package.json
COPY /tsconfig.json /usr/src/app/tsconfig.json
COPY /yarn.lock /usr/src/app/yarn.lock

# COPY /api.yaml /usr/src/app/api.yaml

RUN sudo chmod -R 777 /usr/src/app \
  && yarn install \
  # && yarn generate:models \
  && yarn build

FROM node:8.11.3-alpine
LABEL maintainer="https://www.agid.gov.it"

WORKDIR /usr/src/app

COPY /package.json /usr/src/app/package.json

COPY --from=builder /usr/src/app/src /usr/src/app/src
COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules

EXPOSE 80

CMD ["yarn", "start"]
