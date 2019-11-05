import * as dotenv from "dotenv";

import { getNodeEnvironmentFromProcessEnv } from "italia-ts-commons/lib/environment";

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

// Redirection urls
export const clientProfileRedirectionUrl =
  process.env.CLIENT_REDIRECTION_URL || "/profile.html#token={token}";

// tslint:disable-next-line: no-commented-code
// if (!clientProfileRedirectionUrl.includes("{token}")) {
//   log.error("CLIENT_REDIRECTION_URL must contains a {token} placeholder");
//   process.exit(EINVAL);
// }

export const CLIENT_ERROR_REDIRECTION_URL =
  process.env.CLIENT_ERROR_REDIRECTION_URL || "/error.html";

export const CLIENT_REDIRECTION_URL =
  process.env.CLIENT_REDIRECTION_URL || "/login";

export const REDIS_PORT = process.env.REDIS_PORT || "6379";
export const REDIS_URL = process.env.REDIS_URL || "";
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";

// Set default session duration to 30 days
const DEFAULT_TOKEN_DURATION_IN_SECONDS = 3600 * 24 * 30;
export const TOKEN_DURATION_IN_SECONDS = process.env.TOKEN_DURATION_IN_SECONDS
  ? parseInt(process.env.TOKEN_DURATION_IN_SECONDS, 10)
  : DEFAULT_TOKEN_DURATION_IN_SECONDS;
log.info("Session token duration set to %s seconds", TOKEN_DURATION_IN_SECONDS);

export const AUTHENTICATION_BASE_PATH =
  process.env.AUTHENTICATION_BASE_PATH || "";

export const API_BASE_PATH = process.env.API_BASE_PATH || "/api/v1";

export const WEBHOOK_USER_LOGIN_PATH = "/webhook/user";
export const WEBHOOK_USER_LOGIN_BASE_URL =
  process.env.WEBHOOK_USER_LOGIN_BASE_URL || "http://localhost";

export const DEFAULT_USER_ROLE_ID = "authenticated";
export const USER_ROLE_ID = process.env.USER_ROLE_ID || DEFAULT_USER_ROLE_ID;

export const JWT_SECRET = process.env.JWT_SECRET || "";
export const WEBHOOK_JWT_SECRET = process.env.WEBHOOK_JWT_SECRET || "";

export const HASURA_GRAPHQL_ENDPOINT =
  process.env.HASURA_GRAPHQL_ENDPOINT || "http://hasura/v1/graphql";

export const HASURA_GRAPHQL_ADMIN_SECRET =
  process.env.HASURA_GRAPHQL_ADMIN_SECRET || "";

export const HASURA_WEBHOOK_SECRET = process.env.HASURA_WEBHOOK_SECRET || "";

export const DUMB_IPA_VALUE_FOR_NULL = "da_indicare@x.it";

export const SESSION_PREFIX = "SESSION-";
export const SECRET_PREFIX = "SECRET-";

export const RTD_ROLE_NAME = "rtd";

// maximum retries over duration
export const RATE_LIMIT_POINTS = 30;

// 1 hour
export const RATE_LIMIT_DURATION = 3600;

export const NODE_EVENTS_CHANNEL_NAME = "events-node";

/////////// Authentication email configuration

export const SERVICE_NAME = process.env.SERVICE_NAME || "";
export const ORGANIZATION_NAME = process.env.ORGANIZATION_NAME || "";

export const AUTHMAIL_FROM = process.env.AUTHMAIL_FROM;
export const AUTHMAIL_REPLY_TO = process.env.AUTHMAIL_REPLY_TO;
export const AUTHMAIL_TEST_ADDRESS = process.env.AUTHMAIL_TEST_ADDRESS;

export const SMTP_CONNECTION_URL = process.env.SMTP_CONNECTION_URL;

// Queues

export const QUEUE_MAX_ATTEMPTS = 30;
export const QUEUE_INITIAL_DELAY_MS = 1000;

// Minio

export const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "";
export const MINIO_SERVER_HOST = process.env.MINIO_SERVER_HOST || "";
export const MINIO_SERVER_PORT_NUMBER = parseInt(
  process.env.MINIO_SERVER_PORT_NUMBER || "9000",
  10
);
export const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "";
export const MINIO_DEFAULT_BUCKETS = process.env.MINIO_DEFAULT_BUCKETS || "";
export const MINIO_DEFAULT_REGION = "eu-west-1";

export const UPLOAD_SERVER_PORT = parseInt(
  process.env.UPLOAD_SERVER_PORT || "8888",
  10
);
