import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";
import { AppUser } from "../types/user";
import { IRequestMiddleware } from "./request_middleware";

/**
 * Returns a request middleware that validates the presence of a required
 * parameter in the request.params object.
 *
 * @param name  The name of the parameter
 * @param type  The io-ts Type for validating the parameter
 */
export function UserFromRequestMiddleware(): IRequestMiddleware<
  "IResponseErrorValidation",
  AppUser
> {
  return request =>
    new Promise(resolve => {
      const validation = AppUser.decode(request.user);
      const result = validation.mapLeft(
        ResponseErrorFromValidationErrors(AppUser)
      );
      resolve(result);
    });
}
