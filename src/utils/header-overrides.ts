import type { CallValidHeaders } from "psn-api";

export function getHeaderOverrides(): CallValidHeaders {
  return {
    "Accept-Language": "zh-Hans-CN",
  };
}
