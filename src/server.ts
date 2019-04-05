/**
 * Main entry point for the Digital Citizenship proxy.
 */

import * as http from "http";
import * as https from "https";
import { NodeEnvironmentEnum } from "italia-ts-commons/lib/environment";
import { newApp } from "./app";

import { NODE_ENVIRONMENT, SERVER_PORT } from "./config";
import { log } from "./utils/logger";

const port = SERVER_PORT;
const env = NODE_ENVIRONMENT;

export const authenticationBasePath = container.resolve<string>(
  "AuthenticationBasePath"
);

const app = newApp(env, authenticationBasePath);

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
