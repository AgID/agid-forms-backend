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

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "italia-ts-commons/lib/request_middleware";

import * as Bull from "bull";
import { isLeft } from "fp-ts/lib/Either";
import { EmailString } from "italia-ts-commons/lib/strings";
import { GET_RTD_FROM_IPA, GraphqlClient } from "../clients/graphql";
import {
  DUMB_IPA_VALUE_FOR_NULL,
  RTD_ROLE_NAME,
  ISTAT_SCHOOL_TIPOLOGY
} from "../config";
import { DecodeBodyMiddleware } from "../middlewares/decode_body";
import { RequiredParamMiddleware } from "../middlewares/required_param";

import { HasuraJwtService } from "../services/jwt";
import { IObjectStorage } from "../services/object_storage";
import { generateNewToken } from "../services/token";
import { emailAuthCode } from "../templates/html/email/auth_ipa_template";
import { GraphqlToken, SessionToken } from "../types/token";
import { AppUser } from "../types/user";
import { log } from "../utils/logger";

import { ApolloQueryResult } from "apollo-client";
import { GetPaFromIpa } from "../generated/api/GetPaFromIpa";
import { LoginCredentials } from "../generated/api/LoginCredentials";

import { UserProfile } from "../generated/api/UserProfile";

import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  GetPaFromIpa as GraphqlGetPaFromIpa,
  GetPaFromIpaVariables as GraphqlGetPaFromIpaVariables
} from "../generated/graphql/GetPaFromIpa";

import { GetOrCreateUser } from "../utils/auth";
import { queueEmail } from "../utils/queue_client";
import { SendmailProcessorInputT } from "../workers/email_processor";

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
  generateCode: () => string,
  queueClient: Bull.Queue,
  secretStorage: IObjectStorage<string, string>
): ISendMailToRtd {
  return async (ipaCode: string) => {
    // Retrieve PA info and RTD email address
    const errorOrPaInfo = await graphqlClient.query<
      GraphqlGetPaFromIpa,
      GraphqlGetPaFromIpaVariables
    >({
      fetchPolicy: "no-cache",
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
    const isSchool = paInfo.ipa_pa[0].tipologia_istat === ISTAT_SCHOOL_TIPOLOGY;
    // Filter out "da_indicare@x.it"
    const hasRtd = DUMB_IPA_VALUE_FOR_NULL === rtdEmail;
    const schoolHasMail = paInfo.ipa_pa[0].mail2 !== "null";
    const schoolMail = paInfo.ipa_pa[0].mail2;
    const canSendMail = (hasRtd && !isSchool) || (isSchool && schoolHasMail);

    log.debug("Get PA info: (%s)", JSON.stringify(paInfo));

    if (!canSendMail) {
      return ResponseErrorNotFound("Not found", "Mail address not set.");
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
    const emailAuthCodeContent = emailAuthCode(
      secretCode,
      paInfo.ipa_pa[0].des_amm,
      paInfo.ipa_pa[0].cod_amm,
      isSchool
    );

    const message: SendmailProcessorInputT = {
      content: emailAuthCodeContent.html,
      subject: emailAuthCodeContent.title,
      to: !isSchool ? rtdEmail : schoolMail
    };

    log.debug(
      "dispatch sendmail event to processor: %s",
      JSON.stringify(message)
    );

    await queueEmail(queueClient, message);

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
        regione: pa.Regione,
        tipologia_istat: pa.tipologia_istat,
        mail2: pa.mail2
      }
    });
  };
}

export function SendEmailToRtd(
  graphqlClient: GraphqlClient,
  generateCode: () => string,
  queueClient: Bull.Queue,
  secretStorage: IObjectStorage<string, string>
): express.RequestHandler {
  const handler = SendEmailToRtdHandler(
    graphqlClient,
    generateCode,
    queueClient,
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
  hasuraJwtService: ReturnType<HasuraJwtService>
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
      fetchPolicy: "no-cache",
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
    const isSchool = paInfo.ipa_pa[0].tipologia_istat === ISTAT_SCHOOL_TIPOLOGY;
    const schoolMail = paInfo.ipa_pa[0].mail2;

    log.debug("Get PA info: (%s)", JSON.stringify(paInfo));

    // Make user object
    const user: AppUser = {
      created_at: new Date().getTime(),
      email: (!isSchool ? rtdEmail : schoolMail) as EmailString,
      group: ipaCode,
      // this kind of login (via rtd email)
      // assigns the "RTD" role to the user
      roles: [RTD_ROLE_NAME],
      session_token: token
    };

    const errorOrMetadata = await GetOrCreateUser(
      graphqlClient,
      hasuraJwtService,
      user
    ).run();

    if (isLeft(errorOrMetadata)) {
      return ResponseErrorInternal(
        "Error creating user: " + errorOrMetadata.value.message
      );
    }
    const metadata = errorOrMetadata.value;

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
        email: !isSchool ? rtdEmail : schoolMail,
        id: metadata.id,
        roles: user.roles
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
  hasuraJwtService: ReturnType<HasuraJwtService>
): express.RequestHandler {
  const handler = LoginHandler(
    graphqlClient,
    secretStorage,
    sessionStorage,
    hasuraJwtService
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredParamMiddleware("ipa_code", t.string),
    DecodeBodyMiddleware(LoginCredentials)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
