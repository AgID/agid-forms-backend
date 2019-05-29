import * as bodyParser from "body-parser";
import * as express from "express";

import * as helmet from "helmet";
import * as http from "http";
import * as t from "io-ts";
import * as morgan from "morgan";
import * as passport from "passport";

import proxy = require("express-http-proxy");

import { isLeft } from "fp-ts/lib/Either";
import { toExpressHandler } from "italia-ts-commons/lib/express";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";

import {
  ADMIN_UID,
  API_BASE_PATH,
  ELASTICSEARCH_URL,
  JSONAPI_BASE_URL,
  JWT_EXPIRES_IN,
  JWT_SECRET,
  SERVER_PORT,
  SESSION_PREFIX,
  SMTP_CONNECTION_URL,
  TOKEN_DURATION_IN_SECONDS,
  USER_ROLE_ID,
  WEBHOOK_JWT_SECRET,
  WEBHOOK_USER_LOGIN_BASE_URL,
  WEBHOOK_USER_LOGIN_PATH
} from "./config";
import { DrupalJwtService, WebhookJwtService } from "./services/jwt";

import bearerTokenStrategy from "./strategies/bearer_token";

import { createFetchRequestForApi } from "italia-ts-commons/lib/requests";
import nodeFetch from "node-fetch";

import * as nodemailer from "nodemailer";
import { JsonapiClient } from "./clients/jsonapi";
import { Login, Logout, SendEmailToRtd } from "./controllers/auth";
import {
  GetPublicAdministration,
  SearchPublicAdministrations
} from "./controllers/ipa";
import { getProfile } from "./controllers/profile";
import { AuthWebhook } from "./controllers/webhook";
import { RedisObjectStorage } from "./services/redis_object_storage";
import { SessionToken } from "./types/token";
import { AppUser } from "./types/user";
import { generateCode } from "./utils/code_generator";
import { log } from "./utils/logger";
import { createSimpleRedisClient, DEFAULT_REDIS_PORT } from "./utils/redis";
import { ouGetRequest, paGetRequest, paSearchRequest } from "./utils/search";
import { userWebhook } from "./utils/webhooks";

const port = SERVER_PORT;

// tslint:disable-next-line: no-any
const fetchApi = (nodeFetch as any) as typeof fetch;

//
// Create Redis session storage
//

const redisClient = createSimpleRedisClient(
  parseInt(process.env.REDIS_PORT || DEFAULT_REDIS_PORT, 10),
  process.env.REDIS_URL!,
  process.env.REDIS_PASSWORD!
);

const sessionStorage = RedisObjectStorage<AppUser, SessionToken>(
  redisClient,
  TOKEN_DURATION_IN_SECONDS,
  AppUser,
  user => `${SESSION_PREFIX}${user.session_token}`,
  key => `${SESSION_PREFIX}${key}`
);

const bearerTokenAuth = passport.authenticate("bearer", { session: false });

//
//  Configure controllers and services
//
const drupalJwtService = DrupalJwtService(JWT_SECRET, JWT_EXPIRES_IN);
const webhookJwtService = WebhookJwtService(WEBHOOK_JWT_SECRET, JWT_EXPIRES_IN);

// Setup Passport.

// Add the strategy to authenticate proxy clients.
passport.use(bearerTokenStrategy(sessionStorage));

// Used to call webhook
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: Buffer.from(WEBHOOK_JWT_SECRET, "base64")
    },
    (jwtPayload, done) => done(null, jwtPayload)
  )
);

// Create and setup the Express app.
const app = express();

// Add security to http headers.
app.use(helmet());

// Add a request logger.
const loggerFormat =
  ":date[iso] [info]: :method :url :status - :response-time ms";
app.use(morgan(loggerFormat));

// Parse the incoming request body.
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

app.get(
  `${API_BASE_PATH}/profile`,
  bearerTokenAuth,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(getProfile)(req, res);
  }
);

const paSearchRequestApi = createFetchRequestForApi(paSearchRequest, {
  baseUrl: ELASTICSEARCH_URL,
  fetchApi
});

const paGetRequestApi = createFetchRequestForApi(paGetRequest, {
  baseUrl: ELASTICSEARCH_URL,
  fetchApi
});

const ouGetRequestApi = createFetchRequestForApi(ouGetRequest, {
  baseUrl: ELASTICSEARCH_URL,
  fetchApi
});

app.get(
  `${API_BASE_PATH}/search_ipa`,
  SearchPublicAdministrations(paSearchRequestApi)
);

app.get(
  `${API_BASE_PATH}/get_ipa`,
  GetPublicAdministration(paGetRequestApi, ouGetRequestApi)
);

const nodedmailerTransporter = nodemailer.createTransport(SMTP_CONNECTION_URL);

const secretStorage = RedisObjectStorage(
  redisClient,
  TOKEN_DURATION_IN_SECONDS,
  t.string,
  value => value,
  key => key
);

app.post(
  `${API_BASE_PATH}/auth/email/:ipa_code`,
  SendEmailToRtd(
    paGetRequestApi,
    ouGetRequestApi,
    nodedmailerTransporter,
    generateCode,
    secretStorage
  )
);

const userWebhookRequest = createFetchRequestForApi(userWebhook, {
  baseUrl: WEBHOOK_USER_LOGIN_BASE_URL,
  fetchApi
});

app.post(
  `${API_BASE_PATH}/auth/login/:ipa_code`,
  Login(
    paGetRequestApi,
    ouGetRequestApi,
    secretStorage,
    sessionStorage,
    userWebhookRequest,
    webhookJwtService
  )
);

app.post(
  `${API_BASE_PATH}/auth/logout`,
  bearerTokenAuth,
  Logout(sessionStorage)
);

const jsonApiClient = JsonapiClient(JSONAPI_BASE_URL);

// Webhook
app.post(
  WEBHOOK_USER_LOGIN_PATH,
  passport.authenticate("jwt", { session: false }),
  AuthWebhook(drupalJwtService, jsonApiClient, ADMIN_UID, USER_ROLE_ID)
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
      // srcReq.user is set by bearerTokenAuth
      const errorOrUser = AppUser.decode(srcReq.user);
      if (isLeft(errorOrUser)) {
        return proxyReqOpts;
      }
      const user = errorOrUser.value;
      if (!user.metadata || !user.metadata.uid) {
        return proxyReqOpts;
      }
      const jwt = drupalJwtService.getJwtForUid(
        parseInt(user.metadata.uid, 10)
      );
      return {
        ...proxyReqOpts,
        headers: { ...proxyReqOpts.headers, Authorization: `Bearer ${jwt}` }
      };
    }
  })
);

//
//  Start HTTP server
//

// HTTPS is terminated by the Kubernetes Ingress controller.
http.createServer(app).listen(port, () => {
  log.info("Listening on port %d", port);
});
