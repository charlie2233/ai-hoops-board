import { browser } from "wxt/browser";

const HOST_NAME = "com.classroom_ai_exporter.host";

export interface NativeResponse {
  ok: boolean;
  error?: string;
  paths?: Record<string, string>;
  [key: string]: unknown;
}

export function sendNativeMessage<TPayload extends Record<string, unknown>>(
  payload: TPayload
): Promise<NativeResponse> {
  return browser.runtime
    .sendNativeMessage(HOST_NAME, payload)
    .then((response) => (response as NativeResponse) || { ok: false, error: "empty native host response" })
    .catch((error: Error) => ({ ok: false, error: error.message || "native host request failed" }));
}
