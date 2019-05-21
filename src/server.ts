/**
 * Main entry point for the SPID proxy.
 */

import * as bodyParser from "body-parser";
import * as express from "express";

import * as helmet from "helmet";
import * as http from "http";
import * as https from "https";
import * as t from "io-ts";
import * as morgan from "morgan";
import * as passport from "passport";

import nodeFetch from "node-fetch";

import expressEnforcesSsl = require("express-enforces-ssl");
import proxy = require("express-http-proxy");

import { isLeft } from "fp-ts/lib/Either";
import { NodeEnvironmentEnum } from "italia-ts-commons/lib/environment";
import { toExpressHandler } from "italia-ts-commons/lib/express";
import { createFetchRequestForApi } from "italia-ts-commons/lib/requests";
import { JsonapiClient } from "./clients/jsonapi";
import {
  ADMIN_UID,
  API_BASE_PATH,
  AUTHENTICATION_BASE_PATH,
  CLIENT_ERROR_REDIRECTION_URL,
  CLIENT_REDIRECTION_URL,
  JSONAPI_BASE_URL,
  JWT_EXPIRES_IN,
  JWT_SECRET,
  NODE_ENVIRONMENT,
  SAML_ACCEPTED_CLOCK_SKEW_MS,
  SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX,
  SAML_CALLBACK_URL,
  SAML_CERT,
  SAML_ISSUER,
  SAML_KEY,
  SERVER_PORT,
  SPID_AUTOLOGIN,
  SPID_TESTENV_URL,
  TOKEN_DURATION_IN_SECONDS,
  USER_ROLE_ID,
  WEBHOOK_USER_LOGIN_BASE_URL,
  WEBHOOK_USER_LOGIN_PATH
} from "./config";
import AuthenticationController from "./controllers/authentication";
import ProfileController from "./controllers/profile";
import SessionController from "./controllers/session";
import WebhookController from "./controllers/webhooks";
import JwtService from "./services/jwt";
import RedisSessionStorage from "./services/redis_session_storage";
import TokenService from "./services/token";
import bearerTokenStrategy from "./strategies/bearer_token";
import makeSpidStrategy from "./strategies/spid_strategy";
import { extractUserFromRequest } from "./types/user";
import { log } from "./utils/logger";
import { createSimpleRedisClient, DEFAULT_REDIS_PORT } from "./utils/redis";
import { withSpidAuth } from "./utils/spid_auth";
import { userWebhook } from "./utils/webhooks";

const port = SERVER_PORT;
const env = NODE_ENVIRONMENT;

//
// Create Redis session storage
//

const redisClient = createSimpleRedisClient(
  parseInt(process.env.REDIS_PORT || DEFAULT_REDIS_PORT, 10),
  process.env.REDIS_URL!,
  process.env.REDIS_PASSWORD!
);

const sessionStorage = new RedisSessionStorage(
  redisClient,
  TOKEN_DURATION_IN_SECONDS
);

//
//  Configure SPID authentication
//

const spidAuth = passport.authenticate("spid", { session: false });

const spidStrategy = makeSpidStrategy(
  SAML_KEY,
  SAML_CALLBACK_URL,
  SAML_ISSUER,
  SAML_ACCEPTED_CLOCK_SKEW_MS,
  SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX,
  SPID_AUTOLOGIN,
  SPID_TESTENV_URL
);

const bearerTokenAuth = passport.authenticate("bearer", { session: false });

//
//  Configure controllers
//
const tokenService = new TokenService();

const userWebhookRequest = createFetchRequestForApi(userWebhook, {
  baseUrl: WEBHOOK_USER_LOGIN_BASE_URL,
  // tslint:disable-next-line: no-any
  fetchApi: (nodeFetch as any) as typeof fetch
});

const acsController = new AuthenticationController(
  sessionStorage,
  SAML_CERT,
  spidStrategy,
  tokenService,
  WEBHOOK_USER_LOGIN_PATH,
  userWebhookRequest
);

const sessionController = new SessionController();

const profileController = new ProfileController();

const jwtService = new JwtService(JWT_SECRET, JWT_EXPIRES_IN);

const jsonApiClient = JsonapiClient(JSONAPI_BASE_URL);

const webhookController = new WebhookController(
  jwtService,
  jsonApiClient,
  ADMIN_UID,
  USER_ROLE_ID
);

// Setup Passport.

// Add the strategy to authenticate proxy clients.
passport.use(bearerTokenStrategy(sessionStorage));

// Add the strategy to authenticate the proxy to SPID.
passport.use(spidStrategy);

// Create and setup the Express app.
const app = express();

// Redirect unsecure connections.
if (env === NodeEnvironmentEnum.DEVELOPMENT) {
  // Trust proxy uses proxy X-Forwarded-Proto for ssl.
  app.enable("trust proxy");
  app.use(/\/((?!ping).)*/, expressEnforcesSsl());
}

// Add security to http headers.
app.use(helmet());

// Add a request logger.
const loggerFormat =
  ":date[iso] [info]: :method :url :status - :response-time ms";
app.use(morgan(loggerFormat));

// Parse the incoming request body. This is needed by Passport spid strategy.
app.use(
  bodyParser.json({
    type: ["application/json", "application/vnd.api+json"]
  })
);

// Parse an urlencoded body.
app.use(bodyParser.urlencoded({ extended: true }));

// Define the folder that contains the public assets.
app.use(express.static("public"));

// Initializes Passport for incoming requests.
app.use(passport.initialize());

// Setup routing.
app.get("/login", spidAuth);

app.get(
  `${AUTHENTICATION_BASE_PATH}/session`,
  bearerTokenAuth,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(sessionController.getSessionState)(
      req,
      res,
      sessionController
    );
  }
);

app.post(
  `${AUTHENTICATION_BASE_PATH}/assertionConsumerService`,
  withSpidAuth(
    acsController,
    CLIENT_ERROR_REDIRECTION_URL,
    CLIENT_REDIRECTION_URL
  )
);

app.post(
  `${AUTHENTICATION_BASE_PATH}/logout`,
  bearerTokenAuth,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(acsController.logout)(req, res, acsController);
  }
);

app.post(
  `${AUTHENTICATION_BASE_PATH}/slo`,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(acsController.slo)(req, res, acsController);
  }
);

app.get(
  `${AUTHENTICATION_BASE_PATH}/metadata`,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(acsController.metadata)(req, res, acsController);
  }
);

app.get(
  `${API_BASE_PATH}/profile`,
  bearerTokenAuth,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(profileController.getProfile)(req, res, profileController);
  }
);

app.post(
  WEBHOOK_USER_LOGIN_PATH,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(webhookController.getUserMetadata)(
      req,
      res,
      webhookController
    );
  }
);

// tslint:disable-next-line: no-var-requires
const packageJson = require("../package.json");
const version = t.string.decode(packageJson.version).getOrElse("UNKNOWN");

app.get("/info", (_, res) => {
  res.status(200).json({ version });
});

// Liveness probe for Kubernetes.
// @see
// https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/#define-a-liveness-http-request
app.get("/ping", (_, res) => res.status(200).send("ok"));

// Setup proxy
app.use(
  "/proxy",
  bearerTokenAuth,
  proxy(JSONAPI_BASE_URL, {
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      const errorOrUser = extractUserFromRequest(srcReq);
      if (isLeft(errorOrUser)) {
        return proxyReqOpts;
      }
      const user = errorOrUser.value;
      if (!user.metadata || !user.metadata.uid) {
        return proxyReqOpts;
      }
      const jwt = jwtService.getJwtForUid(parseInt(user.metadata.uid, 10));
      return {
        ...proxyReqOpts,
        headers: { ...proxyReqOpts.headers, Authorization: "Bearer " + jwt }
      };
    }
  })
);

//
//  Start HTTP server
//

// In test and production environments the HTTPS is terminated by the Kubernetes Ingress controller. In dev we don't use
// Kubernetes so the proxy has to run on HTTPS to behave correctly.
if (env === NodeEnvironmentEnum.DEVELOPMENT) {
  const options = { key: SAML_KEY, cert: SAML_CERT };
  https.createServer(options, app).listen(443, () => {
    log.info("Listening on port 443");
  });
} else {
  http.createServer(app).listen(port, () => {
    log.info("Listening on port %d", port);
  });
}
