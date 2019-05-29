/**
 */
import * as t from "io-ts";
import nodeFetch from "node-fetch";

import {
  basicResponseDecoder,
  BasicResponseType,
  createFetchRequestForApi,
  IGetApiRequestType,
  TypeofApiCall
} from "italia-ts-commons/lib/requests";

/////////////////////////////////////////////////////////////

const PA_INDEX_NAME = "ipa_amministrazioni";

export const PaSearchResultT = t.interface({
  Comune: t.string,
  Provincia: t.string,
  Regione: t.string,
  cod_amm: t.string,
  des_amm: t.string
});

export const PaSearchResultsT = t.interface({
  hits: t.interface({
    hits: t.readonlyArray(
      t.interface({
        _source: PaSearchResultT
      })
    )
  })
});
export type PaSearchResultsT = t.TypeOf<typeof PaSearchResultsT>;

type PaSearchRequestT = IGetApiRequestType<
  {
    readonly paNameOrIpaCode: string;
  },
  never,
  "_source" | "q",
  BasicResponseType<PaSearchResultsT>
>;

/**
 * Get every PA that matches the search parameter.
 */
const paSearchRequest: PaSearchRequestT = {
  headers: () => ({
    "Content-Type": "application/json"
  }),
  method: "get",
  query: params => ({
    _source: `${Object.keys(PaSearchResultT.props).join(",")}`,
    q: `cod_amm:${params.paNameOrIpaCode} OR des_amm_Comune:${
      params.paNameOrIpaCode
    }`
  }),
  response_decoder: basicResponseDecoder(PaSearchResultsT),
  url: () => `${PA_INDEX_NAME}/_search`
};

/**
 * Get exactly one PA using its IPA code
 */
const paGetRequest: PaSearchRequestT = {
  ...paSearchRequest,
  query: params => ({
    _source: `${Object.keys(PaSearchResultT.props).join(",")}`,
    q: `cod_amm:${params.paNameOrIpaCode}`
  })
};

/////////////////////////////////////////////////////////////

const OU_INDEX_NAME = "ipa_ou";

export const OuGetResultT = t.interface({
  cogn_resp: t.string,
  mail_resp: t.string,
  nome_resp: t.string
});

export const OuGetResultsT = t.interface({
  hits: t.interface({
    hits: t.readonlyArray(
      t.interface({
        _source: OuGetResultT
      })
    )
  })
});
export type OuGetResultsT = t.TypeOf<typeof OuGetResultsT>;

type OuGetRequestT = IGetApiRequestType<
  {
    readonly ipaCode: string;
  },
  never,
  "_source" | "q",
  BasicResponseType<OuGetResultsT>
>;

const OU_UFFICIO_TRANSIZIONE_DIGITALE = "Ufficio_Transizione_Digitale";

/**
 * Get name, surname and email of the Digital Transformation Responsible.
 */
const ouGetRequest: OuGetRequestT = {
  headers: () => ({
    "Content-Type": "application/json"
  }),
  method: "get",
  query: params => ({
    _source: `${Object.keys(OuGetResultT.props).join(",")}`,
    q: `cod_amm:"${
      params.ipaCode
    }" AND cod_ou:"${OU_UFFICIO_TRANSIZIONE_DIGITALE}"`
  }),
  response_decoder: basicResponseDecoder(OuGetResultsT),
  url: () => `${OU_INDEX_NAME}/_search`
};

/////////////////////////////////////////////////////////////

export function IpaSearchClient(
  baseUrl?: string,
  // tslint:disable-next-line:no-any
  fetchApi: typeof fetch = (nodeFetch as any) as typeof fetch
): {
  ouGetRequest: TypeofApiCall<OuGetRequestT>;
  paGetRequest: TypeofApiCall<PaSearchRequestT>;
  paSearchRequest: TypeofApiCall<PaSearchRequestT>;
} {
  const opts = {
    baseUrl,
    fetchApi
  };
  return {
    ouGetRequest: createFetchRequestForApi(ouGetRequest, opts),
    paGetRequest: createFetchRequestForApi(paGetRequest, opts),
    paSearchRequest: createFetchRequestForApi(paSearchRequest, opts)
  };
}

export type IpaSearchClient = typeof IpaSearchClient;
