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

import { isLeft } from "fp-ts/lib/Either";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { withRequestMiddlewares } from "../middlewares/request_middleware";
import { wrapRequestHandler } from "../middlewares/request_middleware";
import { RequiredQueryParamMiddleware } from "../middlewares/required_query_param";

import {
  IpaSearchClient,
  OuGetResultT,
  PaSearchResultT
} from "../clients/ipa_search";
import { RequiredParamMiddleware } from "../middlewares/required_param";

///////////////////////////////////////////////

const PublicAdministrationsFromIpa = t.interface({
  items: t.readonlyArray(t.interface({ _source: PaSearchResultT })),
  page_size: t.Integer
});
type PublicAdministrationsFromIpa = t.TypeOf<
  typeof PublicAdministrationsFromIpa
>;

type ISearchPublicAdministrationFromIpa = (
  name: string
) => Promise<
  | IResponseErrorValidation
  | IResponseErrorInternal
  | IResponseSuccessJson<PublicAdministrationsFromIpa>
>;

export function SearchPublicAdministrationsHandler(
  ipaSearchClient: ReturnType<IpaSearchClient>
): ISearchPublicAdministrationFromIpa {
  return async (paNameOrIpaCode: string) => {
    const errorOrPaSearchResponse = await ipaSearchClient.paSearchRequest({
      paNameOrIpaCode
    });
    if (isLeft(errorOrPaSearchResponse)) {
      return ResponseErrorInternal(
        `Cannot get search results: ${readableReport(
          errorOrPaSearchResponse.value
        )}`
      );
    }
    if (errorOrPaSearchResponse.value.status !== 200) {
      return ResponseErrorInternal(
        `Cannot get search results (status=${
          errorOrPaSearchResponse.value.status
        })`
      );
    }
    const paSearchResponse = errorOrPaSearchResponse.value;
    if (
      !paSearchResponse.value.hits.hits ||
      paSearchResponse.value.hits.hits.length === 0
    ) {
      return ResponseSuccessJson({
        items: [],
        page_size: 0
      });
    }
    return ResponseSuccessJson({
      items: paSearchResponse.value.hits.hits,
      page_size: paSearchResponse.value.hits.hits.length
    });
  };
}

export function SearchPublicAdministrations(
  ipaSearchClient: ReturnType<IpaSearchClient>
): express.RequestHandler {
  const handler = SearchPublicAdministrationsHandler(ipaSearchClient);
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredQueryParamMiddleware("name", t.string)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}

///////////////////////////////////////////////

export const PublicAdministrationFromIpa = t.intersection([
  PaSearchResultT,
  OuGetResultT
]);
export type PublicAdministrationFromIpa = t.TypeOf<
  typeof PublicAdministrationFromIpa
>;

type IGetPublicAdministrationFromIpa = (
  name: string
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseErrorValidation
  | IResponseErrorInternal
  | IResponseErrorNotFound
  | IResponseSuccessJson<PublicAdministrationFromIpa>
>;

export function GetPublicAdministrationHandler(
  ipaSearchClient: ReturnType<IpaSearchClient>
): IGetPublicAdministrationFromIpa {
  return async (ipaCode: string) => {
    const errorOrPaGetResponse = await ipaSearchClient.paGetRequest({
      paNameOrIpaCode: ipaCode
    });
    if (isLeft(errorOrPaGetResponse)) {
      return ResponseErrorInternal(
        `Cannot get pa results: ${readableReport(errorOrPaGetResponse.value)}`
      );
    }
    if (errorOrPaGetResponse.value.status !== 200) {
      return ResponseErrorInternal(
        `Cannot get pa results (status=${errorOrPaGetResponse.value.status})`
      );
    }
    const paGetResponse = errorOrPaGetResponse.value;

    if (
      !paGetResponse.value.hits.hits ||
      paGetResponse.value.hits.hits.length === 0
    ) {
      return ResponseErrorNotFound("Not found.", "Ipa code not found");
    }

    // Get RTD data

    const errorOrOuGetResponse = await ipaSearchClient.ouGetRequest({
      ipaCode
    });

    if (isLeft(errorOrOuGetResponse)) {
      return ResponseErrorInternal(
        `Cannot get ou results: ${readableReport(errorOrOuGetResponse.value)}`
      );
    }
    if (errorOrOuGetResponse.value.status !== 200) {
      return ResponseErrorInternal(
        `Cannot get ou results (status=${errorOrOuGetResponse.value.status})`
      );
    }
    const ouGetResponse = errorOrOuGetResponse.value;

    // paSearchResponse.value.hits.hits[0]
    return ResponseSuccessJson({
      ...paGetResponse.value.hits.hits[0]._source,
      ...ouGetResponse.value.hits.hits[0]._source
    });
  };
}

export function GetPublicAdministration(
  ipaSearchClient: ReturnType<IpaSearchClient>
): express.RequestHandler {
  const handler = GetPublicAdministrationHandler(ipaSearchClient);
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredParamMiddleware("ipa_code", t.string)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
