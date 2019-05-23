/**
 * This controller handles reading the user profile from the
 * app by forwarding the call to the API system.
 */

import * as express from "express";

import {
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import * as t from "io-ts";
import { ELASTICSEARCH_URL } from "../config";
import { DecodeBodyMiddleware } from "../middlewares/decode_body";
import { withRequestMiddlewares } from "../middlewares/request_middleware";
import { wrapRequestHandler } from "../middlewares/request_middleware";

const IpaQuery = t.string;
type IpaQuery = t.TypeOf<typeof IpaQuery>;

const PublicAdministrationFromIpa = t.interface({});
type PublicAdministrationFromIpa = t.TypeOf<typeof PublicAdministrationFromIpa>;

type IGetPublicAdministrationFromIpa = (
  query: IpaQuery
) => Promise<
  IResponseErrorValidation | IResponseSuccessJson<PublicAdministrationFromIpa>
>;

const PA_INDEX_NAME = "ipa_amministrazioni";

const OU_INDEX_NAME = "ipa_ou";

const RETRIEVED_PA_FIELDS: ReadonlyArray<string> = [
  "cod_amm",
  "des_amm",
  "Comune",
  "Provincia,Regione"
];

const RETRIEVED_OU_FIELDS: ReadonlyArray<string> = [
  "mail_resp",
  "nome_resp",
  "cogn_resp"
];

const getPaQueryUrl = (paNameOrIpaCode: string) =>
  `${ELASTICSEARCH_URL}/${PA_INDEX_NAME}/_search?_source=${RETRIEVED_PA_FIELDS.join(
    ","
  )}&q=cod_amm:${paNameOrIpaCode} OR des_amm_Comune:${paNameOrIpaCode}`;

const getOuQueryUrl = (ipaCode: string) =>
  `${ELASTICSEARCH_URL}/${OU_INDEX_NAME}/_search?_source=${RETRIEVED_OU_FIELDS.join(
    ","
  )}&q=cod_ou:Ufficio_Transizione_Digitale AND cod_amm:${ipaCode}`;

/**
 * -> hits.hits[<idx>]._source.{...}
 */
export function GetPublicAdministrationFromIpaHandler(): IGetPublicAdministrationFromIpa {
  return async (_: IpaQuery) => {
    return ResponseSuccessJson({});
  };
}

export function GetPublicAdministrationFromIpa(): express.RequestHandler {
  const handler = GetPublicAdministrationFromIpaHandler();
  const withrequestMiddlewares = withRequestMiddlewares(
    DecodeBodyMiddleware(IpaQuery)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
