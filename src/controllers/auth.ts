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
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import * as t from "io-ts";

import { TypeofApiCall } from "italia-ts-commons/lib/requests";

import { withRequestMiddlewares } from "../middlewares/request_middleware";
import { wrapRequestHandler } from "../middlewares/request_middleware";
import { OuGetRequestT, PaSearchRequestT } from "../utils/search";
import {
  GetPublicAdministrationHandler,
  PublicAdministrationFromIpa
} from "./ipa";

import { isLeft } from "fp-ts/lib/Either";
import { EmailString } from "italia-ts-commons/lib/strings";
import * as nodemailer from "nodemailer";
import {
  AUTHMAIL_FROM,
  AUTHMAIL_REPLY_TO,
  AUTHMAIL_TEST_ADDRESS,
  DUMB_IPA_VALUE_FOR_NULL,
  ORGANIZATION_NAME,
  SERVICE_NAME,
  WEBHOOK_USER_LOGIN_PATH
} from "../config";
import { DecodeBodyMiddleware } from "../middlewares/decode_body";
import { RequiredParamMiddleware } from "../middlewares/required_param";
import { UserFromRequestMiddleware } from "../middlewares/user_from_request";
import { WebhookJwtService } from "../services/jwt";
import { IObjectStorage } from "../services/object_storage";
import { generateNewToken } from "../services/token";
import { withDefaultEmailTemplate } from "../templates/html/default";
import { emailAuthCode } from "../templates/html/email/authcode";
import { SessionToken } from "../types/token";
import { AppUser } from "../types/user";
import { log } from "../utils/logger";
import { UserWebhookT } from "../utils/webhooks";

type ISendMailToRtd = (
  ipaCode: string
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorInternal
  | IResponseSuccessJson<PublicAdministrationFromIpa>
>;

const generateKey = (secretCode: string, ipaCode: string) =>
  `${secretCode}_${ipaCode}`;

export function SendEmailToRtdHandler(
  paSearchRequest: TypeofApiCall<PaSearchRequestT>,
  ouGetRequest: TypeofApiCall<OuGetRequestT>,
  transporter: nodemailer.Transporter,
  generateCode: () => string,
  secretStorage: IObjectStorage<string, string>
): ISendMailToRtd {
  return async (ipaCode: string) => {
    // Call search API to retrieve PA info and RTD email address
    const paResponse = await GetPublicAdministrationHandler(
      paSearchRequest,
      ouGetRequest
    )(ipaCode);
    if (paResponse.kind !== "IResponseSuccessJson") {
      return paResponse;
    }
    const paInfo = paResponse.value;

    log.debug("Get PA info: (%s)", JSON.stringify(paInfo));

    // Filter out "da_indicare@x.it"
    if (DUMB_IPA_VALUE_FOR_NULL === paInfo.mail_resp) {
      return ResponseErrorNotFound("Not found", "RTD not set yet.");
    }

    const secretCode = generateCode();

    // Save (ipa_code, secret) to storage
    const errorOrStorageResult = await secretStorage.set(
      generateNewToken(),
      () => generateKey(secretCode, ipaCode)
    );

    if (isLeft(errorOrStorageResult)) {
      return ResponseErrorInternal("Cannot store secret");
    }

    // Get email content from template
    const emailAuthCodeContent = emailAuthCode(secretCode, ipaCode);
    const emailAuthCodeHtml = withDefaultEmailTemplate(
      emailAuthCodeContent.title,
      ORGANIZATION_NAME,
      SERVICE_NAME,
      emailAuthCodeContent.html
    );

    // Send email with the secret to the RTD
    await transporter.sendMail({
      from: AUTHMAIL_FROM,
      html: emailAuthCodeHtml,
      replyTo: AUTHMAIL_REPLY_TO,
      subject: emailAuthCodeContent.title,
      text: emailAuthCodeHtml,
      to: AUTHMAIL_TEST_ADDRESS || paInfo.mail_resp
    });

    return ResponseSuccessJson(paInfo);
  };
}

export function SendEmailToRtd(
  paSearchRequest: TypeofApiCall<PaSearchRequestT>,
  ouGetRequest: TypeofApiCall<OuGetRequestT>,
  transporter: nodemailer.Transporter,
  generateCode: () => string,
  secretStorage: IObjectStorage<string, string>
): express.RequestHandler {
  const handler = SendEmailToRtdHandler(
    paSearchRequest,
    ouGetRequest,
    transporter,
    generateCode,
    secretStorage
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredParamMiddleware("ipa_code", t.string)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}

//////////////////////////////////////////////////////////

const LoginInfoT = t.interface({
  secret: t.string
});
type LoginInfoT = t.TypeOf<typeof LoginInfoT>;

type ILogin = (
  ipaCode: string,
  creds: LoginInfoT
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<{ token: SessionToken }>
>;

export function LoginHandler(
  paSearchRequest: TypeofApiCall<PaSearchRequestT>,
  ouGetRequest: TypeofApiCall<OuGetRequestT>,
  secretStorage: IObjectStorage<string, string>,
  sessionStorage: IObjectStorage<AppUser, SessionToken>,
  userWebhookRequest: TypeofApiCall<UserWebhookT>,
  webhookJwtService: ReturnType<WebhookJwtService>
): ILogin {
  return async (ipaCode, creds) => {
    // Check if secret (user's credentials) is valid
    const errorOrToken = await secretStorage.get(
      generateKey(creds.secret, ipaCode)
    );
    if (isLeft(errorOrToken) || !errorOrToken.value) {
      return ResponseErrorForbiddenNotAuthorized;
    }
    const token = errorOrToken.value;

    // Call search API to retrieve RTD email address from IPA
    const paResponse = await GetPublicAdministrationHandler(
      paSearchRequest,
      ouGetRequest
    )(ipaCode);
    if (paResponse.kind !== "IResponseSuccessJson") {
      return paResponse;
    }
    const paInfo = paResponse.value;

    log.debug("Get PA info: (%s)", JSON.stringify(paInfo));

    // Make user object
    const user: AppUser = {
      created_at: new Date().getTime(),
      email: paResponse.value.mail_resp as EmailString,
      name: ipaCode,
      session_token: token as SessionToken
    };

    // Call webhook and retrieve metadata
    const errorOrWebhookResponse = await userWebhookRequest({
      jwt: webhookJwtService.getJwtForWebhook(user),
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

    // Create user session for bearer authentication
    const errorOrSession = await sessionStorage.set(
      { ...user, metadata: webhookResponse.value },
      () => token
    );
    if (isLeft(errorOrSession) || !errorOrSession) {
      return ResponseErrorInternal("Cannot store user info");
    }

    return ResponseSuccessJson({ token: token as SessionToken });
  };
}

export function Login(
  paSearchRequest: TypeofApiCall<PaSearchRequestT>,
  ouGetRequest: TypeofApiCall<OuGetRequestT>,
  secretStorage: IObjectStorage<string, string>,
  sessionStorage: IObjectStorage<AppUser, SessionToken>,
  userWebhookRequest: TypeofApiCall<UserWebhookT>,
  webhookJwtService: ReturnType<WebhookJwtService>
): express.RequestHandler {
  const handler = LoginHandler(
    paSearchRequest,
    ouGetRequest,
    secretStorage,
    sessionStorage,
    userWebhookRequest,
    webhookJwtService
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredParamMiddleware("ipa_code", t.string),
    DecodeBodyMiddleware(LoginInfoT)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}

//////////////////////////////////////////////////////////

type ILogout = (
  user: AppUser
) => Promise<IResponseErrorInternal | IResponseSuccessJson<null>>;

export function LogoutHandler(
  sessionStorage: IObjectStorage<AppUser, SessionToken>
): ILogout {
  return async user => {
    // Delete user session
    const errorOrSession = await sessionStorage.del(user.session_token);
    if (isLeft(errorOrSession) || !errorOrSession.value) {
      return ResponseErrorInternal("Cannot delete user session");
    }
    return ResponseSuccessJson(null);
  };
}

export function Logout(
  sessionStorage: IObjectStorage<AppUser, SessionToken>
): express.RequestHandler {
  const handler = LogoutHandler(sessionStorage);
  const withrequestMiddlewares = withRequestMiddlewares(
    UserFromRequestMiddleware(AppUser)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
