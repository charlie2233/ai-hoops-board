import { browser } from "wxt/browser";

const HOST_NAME = "com.classroom_ai_exporter.host";
const ENABLE_NATIVE_MESSAGING =
  typeof __COURSEBINDER_ENABLE_NATIVE__ !== "undefined" && __COURSEBINDER_ENABLE_NATIVE__;

export interface NativeResponse {
  ok: boolean;
  error?: string;
  paths?: Record<string, string>;
  root?: string;
  index?: Record<string, unknown>;
  [key: string]: unknown;
}

export function sendNativeMessage<TPayload extends object>(
  payload: TPayload
): Promise<NativeResponse> {
  try {
    if (!ENABLE_NATIVE_MESSAGING) {
      return Promise.resolve({ ok: false, error: "native messaging is disabled in this build" });
    }
    if (typeof browser.runtime.sendNativeMessage !== "function") {
      return Promise.resolve({ ok: false, error: "native messaging is not enabled in this build" });
    }
    return browser.runtime
      .sendNativeMessage(HOST_NAME, payload)
      .then((response) => (response as NativeResponse) || { ok: false, error: "empty native host response" })
      .catch((error: Error) => ({ ok: false, error: error.message || "native host request failed" }));
  } catch (error) {
    return Promise.resolve({
      ok: false,
      error: error instanceof Error ? error.message : "native host request failed"
    });
  }
}
