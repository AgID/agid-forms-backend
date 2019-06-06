import * as t from "io-ts";
import { PatternString } from "italia-ts-commons/lib/strings";

export const UUIDString = PatternString("^\\w+-\\w+-\\w+-\\w+-\\w+$");
export type UUIDString = t.TypeOf<typeof UUIDString>;
