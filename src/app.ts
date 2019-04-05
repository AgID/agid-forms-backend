/**
 * Main entry point for the Digital Citizenship proxy.
 */

import { SPID_STRATEGY } from "./config";

import * as bodyParser from "body-parser";
import * as express from "express";
import * as helmet from "helmet";
import * as t from "io-ts";
import * as morgan from "morgan";
import * as passport from "passport";

import { fromNullable } from "fp-ts/lib/Option";

import { Express } from "express";
import expressEnforcesSsl = require("express-enforces-ssl");
import {
  NodeEnvironment,
  NodeEnvironmentEnum
} from "italia-ts-commons/lib/environment";
import { toExpressHandler } from "italia-ts-commons/lib/express";

import AuthenticationController from "./controllers/authentication";
import SessionController from "./controllers/session";

import { log } from "./utils/logger";

import getErrorCodeFromResponse from "./utils/getErrorCodeFromResponse";

/**
 * Catch SPID authentication errors and redirect the client to
 * clientErrorRedirectionUrl.
 */
function withSpidAuth(
  controller: AuthenticationController,
  clientErrorRedirectionUrl: string,
  clientLoginRedirectionUrl: string
): (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => void {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    passport.authenticate("spid", async (err, user) => {
      if (err) {
        log.error("Error in SPID authentication: %s", err);
        return res.redirect(
          clientErrorRedirectionUrl +
            fromNullable(err.statusXml)
              .chain(statusXml => getErrorCodeFromResponse(statusXml))
              .map(errorCode => `?errorCode=${errorCode}`)
              .getOrElse("")
        );
      }
      if (!user) {
        log.error("Error in SPID authentication: no user found");
        return res.redirect(clientLoginRedirectionUrl);
      }
      const response = await controller.acs(user);
      response.apply(res);
    })(req, res, next);
  };
}

const spidAuth = passport.authenticate("spid", { session: false });

export function newApp(
  env: NodeEnvironment,
  authenticationBasePath: string
): Express {
  // Setup Passport.

  // Add the strategy to authenticate proxy clients.
  passport.use(BEARER_TOKEN_STRATEGY);

  // Add the strategy to authenticate the proxy to SPID.
  passport.use(SPID_STRATEGY);

  // Create and setup the Express app.
  const app = express();

  // Redirect unsecure connections.
  if (env !== NodeEnvironmentEnum.DEVELOPMENT) {
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
  app.use(bodyParser.json());
  // Parse an urlencoded body.
  app.use(bodyParser.urlencoded({ extended: true }));
  // Define the folder that contains the public assets.
  app.use(express.static("public"));
  // Initializes Passport for incoming requests.
  app.use(passport.initialize());

  // Setup routing.
  app.get("/login", spidAuth);

  registerPublicRoutes(app);
  registerAuthenticationRoutes(app, authenticationBasePath);
  registerAPIRoutes(app, APIBasePath, allowNotifyIPSourceRange);
  registerPagoPARoutes(app, PagoPABasePath, allowPagoPAIPSourceRange);

  return app;
}

app.get(
  `${basePath}/session`,
  bearerTokenAuth,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(sessionController.getSessionState)(
      req,
      res,
      sessionController
    );
  }
);

const bearerTokenAuth = passport.authenticate("bearer", { session: false });

app.post(
  `${basePath}/assertionConsumerService`,
  withSpidAuth(
    acsController,
    container.resolve("clientErrorRedirectionUrl"),
    container.resolve("clientLoginRedirectionUrl")
  )
);

app.post(
  `${basePath}/logout`,
  bearerTokenAuth,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(acsController.logout)(req, res, acsController);
  }
);

app.post(`${basePath}/slo`, (req: express.Request, res: express.Response) => {
  toExpressHandler(acsController.slo)(req, res, acsController);
});

app.get(
  `${basePath}/metadata`,
  (req: express.Request, res: express.Response) => {
    toExpressHandler(acsController.metadata)(req, res, acsController);
  }
);

const packageJson = require("../package.json");
const version = t.string.decode(packageJson.version).getOrElse("UNKNOWN");

app.get("/info", (_, res) => {
  res.status(200).json({ version });
});

// Liveness probe for Kubernetes.
// @see
// https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/#define-a-liveness-http-request
app.get("/ping", (_, res) => res.status(200).send("ok"));
