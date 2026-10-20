import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HistoryPayload } from "./payload";
import { assertSignalType, exchange, parseIceServers } from "./webrtc";

class FakeChannel {
  peer!: FakeChannel;
  readyState = "open";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  private listeners = new Set<(event: { data: unknown }) => void>();

  send(data: unknown) {
    queueMicrotask(() => this.peer?.dispatch(data));
  }

  addEventListener(type: string, handler: (event: { data: unknown }) => void) {
    if (type === "message") this.listeners.add(handler);
  }

  removeEventListener(type: string, handler: (event: { data: unknown }) => void) {
    if (type === "message") this.listeners.delete(handler);
  }

  private dispatch(data: unknown) {
    this.onmessage?.({ data });
    for (const handler of this.listeners) handler({ data });
  }
}

function pair(): [RTCDataChannel, RTCDataChannel] {
  const a = new FakeChannel();
  const b = new FakeChannel();
  a.peer = b;
  b.peer = a;
  return [a as unknown as RTCDataChannel, b as unknown as RTCDataChannel];
}

function payload(app = "dashboard-admin-sync"): HistoryPayload {
  return {
    app,
    version: 1,
    sentAt: 1,
    transactions: [],
    transactionItems: [],
    expenses: [],
    loyaltyClaims: [],
    customers: [],
    products: [],
    productVariants: [],
    tombstones: [],
    stockEvents: [],
  };
}

describe("assertSignalType", () => {
  it("rejects the wrong SDP type with a clear message", () => {
    const offer = {
      sdp: { type: "offer", sdp: "" } as RTCSessionDescriptionInit,
      pw: "x",
      v: 2,
    };
    assert.throws(() => assertSignalType(offer, "answer"), /Kode 1 \(pengirim\)/);
    assert.doesNotThrow(() => assertSignalType(offer, "offer"));
  });
});

describe("parseIceServers", () => {
  it("parses a valid JSON array and ignores junk", () => {
    assert.deepEqual(parseIceServers('[{"urls":"stun:x:3478"}]'), [
      { urls: "stun:x:3478" },
    ]);
    assert.deepEqual(parseIceServers(""), []);
    assert.deepEqual(parseIceServers("not json"), []);
    assert.deepEqual(parseIceServers("{}"), []);
    assert.deepEqual(parseIceServers('[{"nope":1}]'), []);
  });
});

describe("sync exchange", () => {
  it("exchanges payloads in both directions", async () => {
    const [a, b] = pair();
    const pa = payload("A");
    const pb = payload("B");
    const [fromB, fromA] = await Promise.all([
      exchange(a, pa),
      exchange(b, pb),
    ]);
    assert.deepEqual(fromB, pb);
    assert.deepEqual(fromA, pa);
  });

  it("handles multi-chunk payloads with acks", async () => {
    const [a, b] = pair();
    const big = payload("x".repeat(500_000));
    const small = payload("B");
    const [fromB, fromA] = await Promise.all([
      exchange(a, big),
      exchange(b, small),
    ]);
    assert.deepEqual(fromB, small);
    assert.deepEqual(fromA, big);
  });
});
