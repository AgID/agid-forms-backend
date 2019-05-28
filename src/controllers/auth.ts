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

import * as nodemailer from "nodemailer";
import {
  AUTHMAIL_FROM,
  AUTHMAIL_REPLY_TO,
  AUTHMAIL_TEST_ADDRESS,
  DUMB_IPA_VALUE_FOR_NULL,
  ORGANIZATION_NAME,
  SERVICE_NAME
} from "../config";
import { withDefaultEmailTemplate } from "../templates/html/default";
import { emailAuthCode } from "../templates/html/email/authcode";

type ISendMailToRtd = (
  ipaCode: string
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorInternal
  | IResponseSuccessJson<PublicAdministrationFromIpa>
>;

export function SendEmailToRtdHandler(
  paSearchRequest: TypeofApiCall<PaSearchRequestT>,
  ouGetRequest: TypeofApiCall<OuGetRequestT>,
  transporter: nodemailer.Transporter,
  generateCode: () => string
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

    // exclude "da_indicare@x.it"
    if (DUMB_IPA_VALUE_FOR_NULL === paInfo.mail_resp) {
      return ResponseErrorNotFound("Not found", "RTD not set yet.");
    }

    const secretCode = generateCode();

    // TODO: save (secret, ipa_code) (=user name) to redis (+expire)

    const emailAuthCodeContent = emailAuthCode(secretCode);

    const emailAuthCodeHtml = withDefaultEmailTemplate(
      emailAuthCodeContent.title,
      ORGANIZATION_NAME,
      SERVICE_NAME,
      emailAuthCodeContent.html
    );

    // send email with secret to RTD
    await transporter.sendMail({
      // tslint:disable-next-line: no-duplicate-string
      from: AUTHMAIL_FROM,
      to: AUTHMAIL_TEST_ADDRESS || paInfo.mail_resp,
      // tslint:disable-next-line: object-literal-sort-keys
      replyTo: AUTHMAIL_REPLY_TO,
      subject: emailAuthCodeContent.title,
      text: emailAuthCodeHtml,
      html: emailAuthCodeHtml
    });

    return ResponseSuccessJson(paInfo);
  };
}

export function SendEmailToRtd(
  paSearchRequest: TypeofApiCall<PaSearchRequestT>,
  ouGetRequest: TypeofApiCall<OuGetRequestT>,
  transporter: nodemailer.Transporter,
  generateCode: () => string
): express.RequestHandler {
  const handler = SendEmailToRtdHandler(
    paSearchRequest,
    ouGetRequest,
    transporter,
    generateCode
  );
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredQueryParamMiddleware("code", t.string)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
