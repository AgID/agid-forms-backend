import * as dotenv from "dotenv";
import * as fs from "fs";

import {
  getNodeEnvironmentFromProcessEnv,
  NodeEnvironmentEnum
} from "italia-ts-commons/lib/environment";

import * as redis from "redis";
import RedisClustr = require("redis-clustr");
import RedisSessionStorage from "./services/redis_session_storage";

import { EINVAL } from "constants";
import { log } from "./utils/logger";

// Without this the environment variables loaded by dotenv
// aren't available in this file.
dotenv.config();

// Server port.
const DEFAULT_SERVER_PORT = "80";
export const SERVER_PORT = parseInt(
  process.env.PORT || DEFAULT_SERVER_PORT,
  10
);

// Resolve NODE_ENV environment (defaults to PRODUCTION).
export const NODE_ENVIRONMENT = getNodeEnvironmentFromProcessEnv(process.env);

// Private key used in SAML authentication to a SPID IDP.
export const SAML_KEY = fs.readFileSync(
  process.env.SAML_KEY_PATH || "./certs/key.pem",
  "utf-8"
);

// Public certificate used in SAML authentication to a SPID IDP.
export const SAML_CERT = fs.readFileSync(
  process.env.SAML_CERT_PATH || "./certs/cert.pem",
  "utf-8"
);

// SAML settings.
export const SAML_CALLBACK_URL =
  process.env.SAML_CALLBACK_URL || "http://localhost/assertionConsumerService";

export const SAML_ISSUER =
  process.env.SAML_ISSUER || "https://spid.agid.gov.it/cd";

const DEFAULT_SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX = "1";
export const SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX: number = parseInt(
  process.env.SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX ||
    DEFAULT_SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX,
  10
);

const DEFAULT_SAML_ACCEPTED_CLOCK_SKEW_MS = "-1";
export const SAML_ACCEPTED_CLOCK_SKEW_MS = parseInt(
  process.env.SAML_ACCEPTED_CLOCK_SKEW_MS ||
    DEFAULT_SAML_ACCEPTED_CLOCK_SKEW_MS,
  10
);

const DEFAULT_SPID_AUTOLOGIN = "";
export const SPID_AUTOLOGIN =
  process.env.SPID_AUTOLOGIN || DEFAULT_SPID_AUTOLOGIN;

const DEFAULT_SPID_TESTENV_URL = "https://spid-testenv2:8088";
export const SPID_TESTENV_URL =
  process.env.SPID_TESTENV_URL || DEFAULT_SPID_TESTENV_URL;

// Redirection urls
export const clientProfileRedirectionUrl =
  process.env.CLIENT_REDIRECTION_URL || "/profile.html?token={token}";

if (!clientProfileRedirectionUrl.includes("{token}")) {
  log.error("CLIENT_REDIRECTION_URL must contains a {token} placeholder");
  process.exit(EINVAL);
}

export const clientErrorRedirectionUrl =
  process.env.CLIENT_ERROR_REDIRECTION_URL || "/error.html";

export const clientLoginRedirectionUrl =
  process.env.CLIENT_REDIRECTION_URL || "/login";

//
// Redis server settings.
//

const DEFAULT_REDIS_PORT = "6379";

// Set default session duration to 30 days
const DEFAULT_TOKEN_DURATION_IN_SECONDS = 3600 * 24 * 30;
export const TOKEN_DURATION_IN_SECONDS = process.env.TOKEN_DURATION_IN_SECONDS
  ? parseInt(process.env.TOKEN_DURATION_IN_SECONDS, 10)
  : DEFAULT_TOKEN_DURATION_IN_SECONDS;
log.info("Session token duration set to %s seconds", TOKEN_DURATION_IN_SECONDS);

//
// Register a session storage service backed by Redis.
//

function createSimpleRedisClient(): redis.RedisClient {
  const redisUrl = process.env.REDIS_URL || "redis://redis";
  log.info("Creating SIMPLE redis client", { url: redisUrl });
  return redis.createClient(redisUrl);
}

function createClusterRedisClient():
  | redis.RedisClient
  | RedisClustr
  | undefined {
  const redisUrl = process.env.REDIS_URL;
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisPort: number = parseInt(
    process.env.REDIS_PORT || DEFAULT_REDIS_PORT,
    10
  );

  if (redisUrl === undefined || redisPassword === undefined) {
    log.error(
      "Missing required environment variables needed to connect to Redis host (REDIS_URL, REDIS_PASSWORD)."
    );
    process.exit(1);
    return;
  }

  log.info("Creating CLUSTER redis client", { url: redisUrl });
  return new RedisClustr({
    redisOptions: {
      auth_pass: redisPassword,
      tls: {
        servername: redisUrl
      }
    },
    servers: [
      {
        host: redisUrl,
        port: redisPort
      }
    ]
  });
}

// Use the Docker Redis instance when developing
export const REDIS_CLIENT =
  NODE_ENVIRONMENT === NodeEnvironmentEnum.DEVELOPMENT
    ? createSimpleRedisClient()
    : createClusterRedisClient();

export const SESSION_STORAGE = RedisSessionStorage;
