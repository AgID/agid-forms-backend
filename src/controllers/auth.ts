/**
 * This controller handles reading the user profile from the
 * app by forwarding the call to the API system.
 */

import * as express from "express";
import * as htmlToText from "html-to-text";

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

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "italia-ts-commons/lib/request_middleware";

import { isLeft } from "fp-ts/lib/Either";
import { EmailString } from "italia-ts-commons/lib/strings";
import * as nodemailer from "nodemailer";
import { GET_RTD_FROM_IPA, GraphqlClient } from "../clients/graphql";
import {
  AUTHMAIL_FROM,
  AUTHMAIL_REPLY_TO,
  AUTHMAIL_TEST_ADDRESS,
  DUMB_IPA_VALUE_FOR_NULL,
  ORGANIZATION_NAME,
  RTD_ROLE_NAME,
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
import { GraphqlToken, SessionToken } from "../types/token";
import { AppUser } from "../types/user";
import { log } from "../utils/logger";

import { ApolloQueryResult } from "apollo-client";
import { GetPaFromIpa } from "../generated/api/GetPaFromIpa";
import { LoginCredentials } from "../generated/api/LoginCredentials";
import { SuccessResponse } from "../generated/api/SuccessResponse";
import { UserProfile } from "../generated/api/UserProfile";

import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  GetPaFromIpa as GraphqlGetPaFromIpa,
  GetPaFromIpaVariables as GraphqlGetPaFromIpaVariables
} from "../generated/graphql/GetPaFromIpa";
import { UserWebhookT } from "../utils/webhooks";

const isPaFound = (errorOrPaInfo: ApolloQueryResult<GraphqlGetPaFromIpa>) =>
  errorOrPaInfo.data.ipa_ou &&
  errorOrPaInfo.data.ipa_pa &&
  errorOrPaInfo.data.ipa_ou[0] &&
  errorOrPaInfo.data.ipa_pa[0];

type ISendMailToRtd = (
  ipaCode: string
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorInternal
  | IResponseSuccessJson<GetPaFromIpa>
>;

const generateKey = (secretCode: string, ipaCode: string) =>
  `${secretCode}_${ipaCode}`;

export function SendEmailToRtdHandler(
  graphqlClient: GraphqlClient,
  transporter: nodemailer.Transporter,
  generateCode: () => string,
  secretStorage: IObjectStorage<string, string>
): ISendMailToRtd {
  return async (ipaCode: string) => {
    // Retrieve PA info and RTD email address
    const errorOrPaInfo = await graphqlClient.query<
      GraphqlGetPaFromIpa,
      GraphqlGetPaFromIpaVariables
    >({
      query: GET_RTD_FROM_IPA,
      variables: {
        code: ipaCode
      }
    });
    if (errorOrPaInfo.errors) {
      return ResponseErrorInternal(errorOrPaInfo.errors.join("\n"));
    }
    if (!isPaFound(errorOrPaInfo)) {
      return ResponseErrorNotFound("Not found", "PA not found in catalogue");
    }
    const paInfo = errorOrPaInfo.data;
    const rtdEmail = paInfo.ipa_ou[0].mail_resp;

    log.debug("Get PA info: (%s)", JSON.stringify(paInfo));

    // Filter out "da_indicare@x.it"
    if (DUMB_IPA_VALUE_FOR_NULL === rtdEmail) {
      return ResponseErrorNotFound("Not found", "RTD not set yet.");
    }

    const secretCode = generateCode();

    // Save (ipa_code, secret) to storage
    const errorOrStorageResult = await secretStorage.set(
      generateKey(secretCode, ipaCode),
      generateNewToken()
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
      text: htmlToText.fromString(emailAuthCodeHtml),
      to: AUTHMAIL_TEST_ADDRESS || rtdEmail
    });

    const pa = paInfo.ipa_pa[0];
    const ou = paInfo.ipa_ou[0];

    return ResponseSuccessJson({
      ipa_ou: {
        cod_ou: ou.cod_ou,
        cogn_resp: ou.cogn_resp,
        mail_resp: ou.mail_resp,
        nome_resp: ou.nome_resp
      },
      ipa_pa: {
        cod_amm: pa.cod_amm,
        comune: pa.Comune,
        des_amm: pa.des_amm,
        provincia: pa.Provincia,
        regione: pa.Regione
      }
    });
  };
}

export function SendEmailToRtd(
  graphqlClient: GraphqlClient,
  transporter: nodemailer.Transporter,
  generateCode: () => string,
  secretStorage: IObjectStorage<string, string>
): express.RequestHandler {
  const handler = SendEmailToRtdHandler(
    graphqlClient,
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

const LoginResultT = t.interface({
  backend_token: SessionToken,
  graphql_token: GraphqlToken,
  user: UserProfile
});
type LoginResultT = t.TypeOf<typeof LoginResultT>;

type ILogin = (
  ipaCode: string,
  creds: LoginCredentials
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorForbiddenNotAuthorized
  | IResponseSuccessJson<LoginResultT>
>;

export function LoginHandler(
  graphqlClient: GraphqlClient,
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
    const token = errorOrToken.value as SessionToken;

    // Retrieve PA info and RTD email address
    const errorOrPaInfo = await graphqlClient.query<
      GraphqlGetPaFromIpa,
      GraphqlGetPaFromIpaVariables
    >({
      query: GET_RTD_FROM_IPA,
      variables: {
        code: ipaCode
      }
    });
    if (errorOrPaInfo.errors) {
      return ResponseErrorInternal(errorOrPaInfo.errors.join("\n"));
    }
    if (!isPaFound(errorOrPaInfo)) {
      return ResponseErrorNotFound("Not found", "PA not found in catalogue");
    }
    const paInfo = errorOrPaInfo.data;
    const rtdEmail = paInfo.ipa_ou[0].mail_resp;

    log.debug("Get PA info: (%s)", JSON.stringify(paInfo));

    // Make user object
    const user: AppUser = {
      created_at: new Date().getTime(),
      email: rtdEmail as EmailString,
      group: ipaCode,
      // this kind of login (via rtd email)
      // assigns the "RTD" role to the user
      roles: [RTD_ROLE_NAME],
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
        email: rtdEmail,
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
  graphqlClient: GraphqlClient,
  secretStorage: IObjectStorage<string, string>,
  sessionStorage: IObjectStorage<AppUser, SessionToken>,
  userWebhookRequest: TypeofApiCall<UserWebhookT>,
  webhookJwtService: ReturnType<WebhookJwtService>
): express.RequestHandler {
  const handler = LoginHandler(
    graphqlClient,
    secretStorage,
    sessionStorage,
    userWebhookRequest,
    webhookJwtService
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredParamMiddleware("ipa_code", t.string),
    DecodeBodyMiddleware(LoginCredentials)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}

//////////////////////////////////////////////////////////

type ILogout = (
  user: AppUser
) => Promise<IResponseErrorInternal | IResponseSuccessJson<SuccessResponse>>;

export function LogoutHandler(
  sessionStorage: IObjectStorage<AppUser, SessionToken>
): ILogout {
  return async user => {
    // Delete user session
    const errorOrSession = await sessionStorage.del(user.session_token);
    if (isLeft(errorOrSession) || !errorOrSession.value) {
      return ResponseErrorInternal("Cannot delete user session");
    }
    return ResponseSuccessJson({ message: "logout" });
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
