/**
 * This controller handles reading the user profile from the
 * app by forwarding the call to the API system.
 */

import * as express from "express";

import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import * as t from "io-ts";

import { TypeofApiCall } from "italia-ts-commons/lib/requests";

import { withRequestMiddlewares } from "../middlewares/request_middleware";
import { wrapRequestHandler } from "../middlewares/request_middleware";
import { RequiredQueryParamMiddleware } from "../middlewares/required_query_param";
import { OuGetRequestT, PaSearchRequestT } from "../utils/search";
import {
  GetPublicAdministrationHandler,
  PublicAdministrationFromIpa
} from "./ipa";

import { isLeft } from "fp-ts/lib/Either";
import * as nodemailer from "nodemailer";
import {
  AUTHMAIL_FROM,
  AUTHMAIL_REPLY_TO,
  AUTHMAIL_TEST_ADDRESS,
  DUMB_IPA_VALUE_FOR_NULL,
  ORGANIZATION_NAME,
  SERVICE_NAME
} from "../config";
import { IObjectStorage } from "../services/object_storage";
import { withDefaultEmailTemplate } from "../templates/html/default";
import { emailAuthCode } from "../templates/html/email/authcode";
import { log } from "../utils/logger";

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
  redisSecretStorage: IObjectStorage<string, string>
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
    const key = generateKey(secretCode, ipaCode);
    const errorOrStorageResult = await redisSecretStorage.set(
      ipaCode,
      () => key
    );

    log.debug("Storing secret: (%s) %s...", ipaCode, key.substr(6));

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
  redisSecretStorage: IObjectStorage<string, string>
): express.RequestHandler {
  const handler = SendEmailToRtdHandler(
    paSearchRequest,
    ouGetRequest,
    transporter,
    generateCode,
    redisSecretStorage
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredQueryParamMiddleware("code", t.string)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
