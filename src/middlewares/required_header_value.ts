import * as t from "io-ts";

import { IRequestMiddleware } from "italia-ts-commons/lib/request_middleware";
import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";

export function RequiredHeaderValueMiddleware(
  name: string
): IRequestMiddleware<"IResponseErrorValidation", string> {
  return async request => {
    console.log(request.headers);
    return t.string
      .decode(request.headers[name])
      .mapLeft(ResponseErrorFromValidationErrors(t.string));
  };
}
