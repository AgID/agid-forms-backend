/**
 */
import * as t from "io-ts";
import {
  basicResponseDecoder,
  BasicResponseType,
  IGetApiRequestType
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

const PaSearchResultsT = t.interface({
  hits: t.interface({
    hits: t.readonlyArray(
      t.interface({
        _source: PaSearchResultT
      })
    )
  })
});
type PaSearchResultsT = t.TypeOf<typeof PaSearchResultsT>;

export type PaSearchRequestT = IGetApiRequestType<
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
export const paSearchRequest: PaSearchRequestT = {
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
export const paGetRequest: PaSearchRequestT = {
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

const OuGetResultsT = t.interface({
  hits: t.interface({
    hits: t.readonlyArray(
      t.interface({
        _source: OuGetResultT
      })
    )
  })
});
type OuGetResultsT = t.TypeOf<typeof OuGetResultsT>;

export type OuGetRequestT = IGetApiRequestType<
  {
    readonly ipaCode: string;
  },
  never,
  "_source" | "q",
  BasicResponseType<OuGetResultsT>
>;

/**
 * Get name, surname and email of the Digital Transformation Responsible.
 */
export const ouGetRequest: OuGetRequestT = {
  headers: () => ({
    "Content-Type": "application/json"
  }),
  method: "get",
  query: params => ({
    _source: `${Object.keys(OuGetResultT.props).join(",")}`,
    q: `cod_amm:${params.ipaCode}`
  }),
  response_decoder: basicResponseDecoder(OuGetResultsT),
  url: () => `${OU_INDEX_NAME}/_search`
};
