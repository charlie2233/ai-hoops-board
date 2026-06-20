import { describe, expect, it, vi } from "vitest";
import { sendNativeMessage } from "./nativeClient";

const sendNativeMessageMock = vi.hoisted(() => vi.fn());

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: {
      sendNativeMessage: sendNativeMessageMock
    }
  }
}));

describe("native client", () => {
  it("does not call native messaging in the default Web Store build", async () => {
    const response = await sendNativeMessage({ type: "ping" });

    expect(response).toEqual({ ok: false, error: "native messaging is disabled in this build" });
    expect(sendNativeMessageMock).not.toHaveBeenCalled();
  });
});
