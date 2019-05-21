import * as dotenv from "dotenv";
import * as fs from "fs";

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

// Set default session duration to 30 days
const DEFAULT_TOKEN_DURATION_IN_SECONDS = 3600 * 24 * 30;
export const TOKEN_DURATION_IN_SECONDS = process.env.TOKEN_DURATION_IN_SECONDS
  ? parseInt(process.env.TOKEN_DURATION_IN_SECONDS, 10)
  : DEFAULT_TOKEN_DURATION_IN_SECONDS;
log.info("Session token duration set to %s seconds", TOKEN_DURATION_IN_SECONDS);

const DEFAULT_JWT_EXPIRES_IN = "30 days";
export const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN;

export const AUTHENTICATION_BASE_PATH =
  process.env.AUTHENTICATION_BASE_PATH || "";

export const API_BASE_PATH = process.env.API_BASE_PATH || "/api/v1";

export const WEBHOOK_USER_LOGIN_PATH = "/webhook/user";
export const WEBHOOK_USER_LOGIN_BASE_URL =
  process.env.WEBHOOK_USER_LOGIN_BASE_URL || "http://localhost";

export const ADMIN_UID = 1;
export const DEFAULT_USER_ROLE_ID = "";
export const USER_ROLE_ID = process.env.USER_ROLE_ID || DEFAULT_USER_ROLE_ID;

export const JWT_SECRET = process.env.JWT_SECRET || "";

export const JSONAPI_BASE_URL = process.env.JSONAPI_BASE_URL || "";
