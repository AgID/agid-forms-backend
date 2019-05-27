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
import { PaSearchRequestT, PaSearchResultT } from "../utils/search";

const PublicAdministrationFromIpa = t.readonlyArray(
  t.interface({ _source: PaSearchResultT })
);
type PublicAdministrationFromIpa = t.TypeOf<typeof PublicAdministrationFromIpa>;

type ISearchPublicAdministrationFromIpa = (
  name: string
) => Promise<
  | IResponseErrorValidation
  | IResponseErrorInternal
  | IResponseSuccessJson<PublicAdministrationFromIpa>
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
    return ResponseSuccessJson(paSearchResponse.value.hits.hits);
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
