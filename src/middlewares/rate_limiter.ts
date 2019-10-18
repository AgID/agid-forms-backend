import { NextFunction, Request, Response } from "express";
import {
  RateLimiterRes,
  RateLimiterStoreAbstract
} from "rate-limiter-flexible";

import { log } from "../utils/logger";

export const makeRateLimiterMiddleware = (
  rateLimiter: RateLimiterStoreAbstract
) => (req: Request, res: Response, next: NextFunction) => {
  const rateLimiterKey = req.ip;
  return rateLimiter
    .consume(rateLimiterKey)
    .then(_ => next())
    .catch((rateLimiterRes: RateLimiterRes) => {
      const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      log.debug("rate limiter block = %s", JSON.stringify(rateLimiterRes));
      res
        .set("Retry-After", retryAfter.toString())
        .set("X-RateLimit-Remaining", rateLimiterRes.remainingPoints.toString())
        .set(
          "X-RateLimit-Reset",
          // tslint:disable-next-line:restrict-plus-operands
          new Date(Date.now() + rateLimiterRes.msBeforeNext).toString()
        )
        .status(429)
        .send("Too Many Requests");
    });
};
