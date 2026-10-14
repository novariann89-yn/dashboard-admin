import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HistoryPayload } from "./payload";
import { receivePayload, sendPayload } from "./webrtc";

class FakeChannel {
  peer!: FakeChannel;
  readyState = "open";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  onmessage: ((event: { data: unknown }) => void) | null = null;
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
  };
}

describe("sync payload transfer", () => {
  it("round-trips a small payload and acks completion", async () => {
    const [sender, receiver] = pair();
    let senderProgress = 0;
    const received = receivePayload(receiver);
    await sendPayload(sender, payload(), (percent) => {
      senderProgress = percent;
    });
    assert.deepEqual(await received, payload());
    assert.equal(senderProgress, 100);
  });

  it("handles multi-chunk payloads with acks", async () => {
    const [sender, receiver] = pair();
    const big = payload("x".repeat(500_000)); // ~8+ chunks of 64 KB
    const received = receivePayload(receiver);
    await sendPayload(sender, big);
    assert.deepEqual(await received, big);
  });
});
