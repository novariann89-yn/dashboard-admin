import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeSignal, encodeSignal, type SignalData } from "./signaling";

describe("signal encoding", () => {
  it("round-trips sdp, password hash and version", async () => {
    const data: SignalData = {
      sdp: { type: "offer", sdp: "v=0\r\na=fingerprint:sha-256 AA\r\n" },
      pw: "deadbeef",
      v: 2,
    };
    const code = await encodeSignal(data);
    assert.deepEqual(await decodeSignal(code), data);
  });

  it("rejects garbage", async () => {
    await assert.rejects(() => decodeSignal("!!!not base64!!!"));
  });
});
