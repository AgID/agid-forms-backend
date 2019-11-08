/**
 * This controller handles reading the user profile from the
 * app by forwarding the call to the API system.
 */

import * as express from "express";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import * as t from "io-ts";

import { TypeofApiCall } from "italia-ts-commons/lib/requests";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "italia-ts-commons/lib/request_middleware";

import * as Bull from "bull";
import { isLeft } from "fp-ts/lib/Either";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { DEFAULT_ROLE_NAME, WEBHOOK_USER_LOGIN_PATH } from "../config";
import { UserProfile } from "../generated/api/UserProfile";
import { DecodeBodyMiddleware } from "../middlewares/decode_body";
import { WebhookJwtService } from "../services/jwt";
import { IObjectStorage } from "../services/object_storage";
import { generateNewToken } from "../services/token";
import { emailAuthCode } from "../templates/html/email/auth_email_template";
import { GraphqlToken, SessionToken } from "../types/token";
import { AppUser } from "../types/user";
import { log } from "../utils/logger";
import { UserWebhookT } from "../utils/webhooks";

import { EmailLoginCredentials } from "../generated/api/EmailLoginCredentials";
import { EmailPayload } from "../generated/api/EmailPayload";
import { queueEmail } from "../utils/queue_client";
import { SendmailProcessorInputT } from "../workers/email_processor";

type ISendMail = (
  email: EmailPayload
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorInternal
  | IResponseSuccessJson<EmailPayload>
>;

const generateKey = (secretCode: string, emailAddress: string) =>
  `${secretCode}_${emailAddress}`;

export function SendEmailHandler(
  generateCode: () => string,
  queueClient: Bull.Queue,
  secretStorage: IObjectStorage<string, string>
): ISendMail {
  return async (emailPayload: EmailPayload) => {
    const emailAddress = emailPayload.email;
    const secretCode = generateCode();

    // Save (emailAddress, secret) to storage
    const errorOrStorageResult = await secretStorage.set(
      generateKey(secretCode, emailAddress),
      generateNewToken()
    );

    if (isLeft(errorOrStorageResult)) {
      return ResponseErrorInternal("Cannot store secret");
    }

    // Get email content from template
    const emailAuthCodeContent = emailAuthCode(secretCode);

    const message: SendmailProcessorInputT = {
      content: emailAuthCodeContent.html,
      subject: emailAuthCodeContent.title,
      to: emailAddress
    };

    log.debug(
      "dispatch sendmail event to processor: %s",
      JSON.stringify(message)
    );

    await queueEmail(queueClient, message);

    return ResponseSuccessJson({
      email: emailAddress
    });
  };
}

export function SendEmail(
  generateCode: () => string,
  queueClient: Bull.Queue,
  secretStorage: IObjectStorage<string, string>
): express.RequestHandler {
  const handler = SendEmailHandler(generateCode, queueClient, secretStorage);
  const withrequestMiddlewares = withRequestMiddlewares(
    DecodeBodyMiddleware(EmailPayload)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}

//////////////////////////////////////////////////////////

const LoginResultT = t.interface({
  backend_token: SessionToken,
  graphql_token: GraphqlToken,
  user: UserProfile
});
type LoginResultT = t.TypeOf<typeof LoginResultT>;

type ILogin = (
  creds: EmailLoginCredentials
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<LoginResultT>
>;

export function LoginHandler(
  secretStorage: IObjectStorage<string, string>,
  sessionStorage: IObjectStorage<AppUser, SessionToken>,
  userWebhookRequest: TypeofApiCall<UserWebhookT>,
  webhookJwtService: ReturnType<WebhookJwtService>
): ILogin {
  return async creds => {
    const emailAddress = creds.email;
    // Check if secret (user's credentials) is valid
    const errorOrToken = await secretStorage.get(
      generateKey(creds.secret, emailAddress)
    );
    if (isLeft(errorOrToken) || !errorOrToken.value) {
      return ResponseErrorForbiddenNotAuthorized;
    }
    const token = errorOrToken.value as SessionToken;

    // Make user object
    const user: AppUser = {
      created_at: new Date().getTime(),
      email: emailAddress,
      group: emailAddress,
      roles: [DEFAULT_ROLE_NAME],
      session_token: token
    };

    // Call webhook and retrieve metadata
    const webhookJwt = webhookJwtService.getJwtForWebhook(user);
    const errorOrWebhookResponse = await userWebhookRequest({
      jwt: webhookJwt,
      webhookPath: WEBHOOK_USER_LOGIN_PATH
    });
    if (
      isLeft(errorOrWebhookResponse) ||
      errorOrWebhookResponse.value.status !== 200
    ) {
      log.error(
        "Error calling webhook: %s",
        JSON.stringify(errorOrWebhookResponse.value)
      );
      return ResponseErrorInternal("Error calling webhook.");
    }
    const webhookResponse = errorOrWebhookResponse.value;
    const metadata = webhookResponse.value;

    // Create user session for bearer authentication
    const errorOrSession = await sessionStorage.set(token, {
      ...user,
      metadata
    });
    if (isLeft(errorOrSession) || !errorOrSession) {
      return ResponseErrorInternal("Cannot store user info");
    }

    return LoginResultT.decode({
      backend_token: token,
      graphql_token: metadata.jwt,
      user: {
        email: emailAddress,
        id: metadata.id
      }
    }).fold<IResponseSuccessJson<LoginResultT> | IResponseErrorInternal>(
      errs =>
        ResponseErrorInternal(
          `Cannot decode login result: ${readableReport(errs)}`
        ),
      value => ResponseSuccessJson(value)
    );
  };
}

export function Login(
  secretStorage: IObjectStorage<string, string>,
  sessionStorage: IObjectStorage<AppUser, SessionToken>,
  userWebhookRequest: TypeofApiCall<UserWebhookT>,
  webhookJwtService: ReturnType<WebhookJwtService>
): express.RequestHandler {
  const handler = LoginHandler(
    secretStorage,
    sessionStorage,
    userWebhookRequest,
    webhookJwtService
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    DecodeBodyMiddleware(EmailLoginCredentials)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
