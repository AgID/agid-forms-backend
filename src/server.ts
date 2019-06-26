import * as bodyParser from "body-parser";
import * as express from "express";

import * as cors from "cors";
import * as helmet from "helmet";
import * as http from "http";
import * as t from "io-ts";
import * as morgan from "morgan";
import * as passport from "passport";

import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import { GraphqlClient } from "./clients/graphql";

import {
  API_BASE_PATH,
  HASURA_WEBHOOK_SECRET,
  JWT_EXPIRES_IN,
  JWT_SECRET,
  RATE_LIMIT_DURATION,
  RATE_LIMIT_POINTS,
  SECRET_PREFIX,
  SERVER_PORT,
  SESSION_PREFIX,
  SMTP_CONNECTION_URL,
  TOKEN_DURATION_IN_SECONDS,
  WEBHOOK_JWT_SECRET,
  WEBHOOK_USER_LOGIN_BASE_URL,
  WEBHOOK_USER_LOGIN_PATH
} from "./config";
import { HasuraJwtService, WebhookJwtService } from "./services/jwt";

import bearerTokenStrategy from "./strategies/bearer_token";

import { createFetchRequestForApi } from "italia-ts-commons/lib/requests";
import nodeFetch from "node-fetch";

import * as nodemailer from "nodemailer";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { Login, Logout, SendEmailToRtd } from "./controllers/auth";
import { AuthWebhook } from "./controllers/auth_webhook";
import { GetProfile } from "./controllers/profile";
import { makeRateLimiterMiddleware } from "./middlewares/rate_limiter";
import { RedisObjectStorage } from "./services/redis_object_storage";
import { SessionToken } from "./types/token";
import { AppUser } from "./types/user";
import { generateCode } from "./utils/code_generator";
import { log } from "./utils/logger";
import { createSimpleRedisClient, DEFAULT_REDIS_PORT } from "./utils/redis";
import { userWebhook } from "./utils/webhooks";

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
  key => `${SESSION_PREFIX}${key}`,
  key => `${SESSION_PREFIX}${key}`
);

//
// Rate limiter for authentication endpoints
//
const rateLimiterMiddleware = makeRateLimiterMiddleware(
  new RateLimiterRedis({
    // number of seconds before consumed points are reset (by IP)
    duration: RATE_LIMIT_DURATION,
    keyPrefix: "authrl",
    // maximum number of points can be consumed over duration
    points: RATE_LIMIT_POINTS,
    redis: redisClient
    // cast needed due to incorrect typings
    // tslint:disable-next-line: no-any
  } as any)
);

//
// Setup Passport
//

// Used to authenticate frontend api calls
passport.use(bearerTokenStrategy(sessionStorage));

const bearerTokenAuth = passport.authenticate("bearer", { session: false });

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

const jwtTokenAuth = passport.authenticate("jwt", { session: false });

//
// Setup dependecies for controllers
//
const hasuraJwtService = HasuraJwtService(JWT_SECRET, JWT_EXPIRES_IN);

const webhookJwtService = WebhookJwtService(WEBHOOK_JWT_SECRET, JWT_EXPIRES_IN);

const userWebhookRequest = createFetchRequestForApi(userWebhook, {
  baseUrl: WEBHOOK_USER_LOGIN_BASE_URL,
  fetchApi
});

const nodedmailerTransporter = nodemailer.createTransport(SMTP_CONNECTION_URL);

const secretStorage = RedisObjectStorage(
  redisClient,
  TOKEN_DURATION_IN_SECONDS,
  t.string,
  key => `${SECRET_PREFIX}${key}`,
  key => `${SECRET_PREFIX}${key}`
);

import packageJson = require("../package.json");
import { GraphqlWebhook } from "./controllers/graphql_webhook";
const version = t.string.decode(packageJson.version).getOrElse("UNKNOWN");

// Create and setup the Express app.
const app = express();

// Add security to http headers.
app.use(helmet());

// Set up CORS (free access to the API from browser clients)
app.use(cors());

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

//
// Setup routes
//

app.post(
  `${API_BASE_PATH}/auth/email/:ipa_code`,
  rateLimiterMiddleware,
  SendEmailToRtd(
    GraphqlClient,
    nodedmailerTransporter,
    generateCode,
    secretStorage
  )
);

app.post(
  `${API_BASE_PATH}/auth/login/:ipa_code`,
  rateLimiterMiddleware,
  Login(
    GraphqlClient,
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

app.post(
  WEBHOOK_USER_LOGIN_PATH,
  jwtTokenAuth,
  AuthWebhook(GraphqlClient, hasuraJwtService)
);

app.get(
  `${API_BASE_PATH}/user/profile`,
  bearerTokenAuth,
  GetProfile(GraphqlClient)
);

app.post(
  `${API_BASE_PATH}/graphql/events`,
  GraphqlWebhook(HASURA_WEBHOOK_SECRET)
);

app.get("/info", (_, res) => {
  res.status(200).json({ version });
});

// Liveness probe for Kubernetes.
// @see
// https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/#define-a-liveness-http-request
app.get("/ping", (_, res) => res.status(200).send("ok"));

//
//  Start HTTP server
//

// HTTPS is terminated by the Kubernetes Ingress controller
http.createServer(app).listen(SERVER_PORT, () => {
  log.info("Listening on port %d", SERVER_PORT);
});
