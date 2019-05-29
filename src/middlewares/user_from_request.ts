import * as t from "io-ts";
import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";
import { log } from "../utils/logger";
import { IRequestMiddleware } from "./request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export function UserFromRequestMiddleware<T>(
  userType: t.Type<T>
): IRequestMiddleware<"IResponseErrorValidation", T> {
  return request =>
    new Promise(resolve => {
      log.info(
        "UserFromRequestMiddleware|Decoding %s",
        JSON.stringify(request.user)
      );
      const validation = userType.decode(request.user);
      const result = validation.mapLeft(
        ResponseErrorFromValidationErrors(userType)
      );
      resolve(result);
    });
}
