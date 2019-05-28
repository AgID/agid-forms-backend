import * as randomstring from "randomstring";

export const generateCode = () =>
  randomstring.generate({
    capitalization: "lowercase",
    charset: "alphanumeric",
    length: 16,
    readable: true
  });

export type generateCode = typeof generateCode;
