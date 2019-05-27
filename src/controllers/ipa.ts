/**
 * This controller handles reading the user profile from the
 * app by forwarding the call to the API system.
 */

import * as express from "express";

import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import * as t from "io-ts";

import { TypeofApiCall } from "italia-ts-commons/lib/requests";

import { isLeft } from "fp-ts/lib/Either";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { withRequestMiddlewares } from "../middlewares/request_middleware";
import { wrapRequestHandler } from "../middlewares/request_middleware";
import { RequiredQueryParamMiddleware } from "../middlewares/required_query_param";
import { log } from "../utils/logger";
import {
  OuGetRequestT,
  OuGetResultT,
  PaSearchRequestT,
  PaSearchResultT
} from "../utils/search";

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
  paSearchRequest: TypeofApiCall<PaSearchRequestT>
): ISearchPublicAdministrationFromIpa {
  return async (paNameOrIpaCode: string) => {
    const errorOrPaSearchResponse = await paSearchRequest({
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

    log.error("paSearchResponse:%s", JSON.stringify(paSearchResponse));

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
  paSearchRequest: TypeofApiCall<PaSearchRequestT>
): express.RequestHandler {
  const handler = SearchPublicAdministrationsHandler(paSearchRequest);
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredQueryParamMiddleware("name", t.string)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}

///////////////////////////////////////////////

const PublicAdministrationFromIpa = t.intersection([
  PaSearchResultT,
  OuGetResultT
]);
type PublicAdministrationFromIpa = t.TypeOf<typeof PublicAdministrationFromIpa>;

type IGetPublicAdministrationFromIpa = (
  name: string
) => Promise<
  | IResponseErrorValidation
  | IResponseErrorInternal
  | IResponseSuccessJson<PublicAdministrationFromIpa>
>;

export function GetPublicAdministrationHandler(
  paGetRequest: TypeofApiCall<PaSearchRequestT>,
  ouGetRequest: TypeofApiCall<OuGetRequestT>
): IGetPublicAdministrationFromIpa {
  return async (ipaCode: string) => {
    const errorOrPaGetResponse = await paGetRequest({
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

    // Get RTD data

    const errorOrOuGetResponse = await ouGetRequest({
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
  paSearchRequest: TypeofApiCall<PaSearchRequestT>,
  ouGetRequest: TypeofApiCall<OuGetRequestT>
): express.RequestHandler {
  const handler = GetPublicAdministrationHandler(paSearchRequest, ouGetRequest);
  const withrequestMiddlewares = withRequestMiddlewares(
    RequiredQueryParamMiddleware("code", t.string)
  );
  return wrapRequestHandler(withrequestMiddlewares(handler));
}
