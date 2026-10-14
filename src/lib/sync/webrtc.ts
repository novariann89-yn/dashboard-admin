import type { HistoryPayload } from "./payload";
import {
  decodeSignal,
  encodeSignal,
  type SignalData,
} from "./signaling";

const CHUNK_SIZE = 64 * 1024;
const BUFFER_HIGH = 1_000_000;
const BUFFER_LOW = 250_000;
const ACK_EVERY = 8;
const STALL_MS = 20_000;

interface SyncMessage {
  t?: string;
  bytes?: number;
  chunks?: number;
  d?: string;
  got?: number;
  message?: string;
}

function parseMessage(data: unknown): SyncMessage | null {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data) as SyncMessage;
  } catch {
    return null;
  }
}

export interface SenderSession {
  pc: RTCPeerConnection;
  code: string;
  channel: RTCDataChannel;
}

export interface ReceiverSession {
  pc: RTCPeerConnection;
  answerCode: string;
  channel: Promise<RTCDataChannel>;
}

function createPeer(): RTCPeerConnection {
  // ponytail: no STUN/TURN (no third party). Same-WiFi host candidates suffice;
  // add a STUN server only if cross-network sync is ever needed.
  return new RTCPeerConnection({ iceServers: [] });
}

function waitForIceGathering(
  pc: RTCPeerConnection,
  timeoutMs = 8000,
): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(done, timeoutMs);
  });
}

export async function startSender(pw: string): Promise<SenderSession> {
  const pc = createPeer();
  const channel = pc.createDataChannel("sync", { ordered: true });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);
  const code = await encodeSignal({
    sdp: pc.localDescription as RTCSessionDescriptionInit,
    pw,
  });
  return { pc, code, channel };
}

export async function finishSender(
  session: SenderSession,
  answerCode: string,
  pw: string,
): Promise<void> {
  const answer = await decodeSignal(answerCode);
  assertPassword(answer, pw);
  await session.pc.setRemoteDescription(answer.sdp);
}

export async function startReceiver(
  offerCode: string,
  pw: string,
): Promise<ReceiverSession> {
  const offer = await decodeSignal(offerCode);
  assertPassword(offer, pw);

  const pc = createPeer();
  const channel = new Promise<RTCDataChannel>((resolve) => {
    pc.ondatachannel = (event) => resolve(event.channel);
  });
  await pc.setRemoteDescription(offer.sdp);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc);
  const answerCode = await encodeSignal({
    sdp: pc.localDescription as RTCSessionDescriptionInit,
    pw,
  });
  return { pc, answerCode, channel };
}

function assertPassword(signal: SignalData, pw: string): void {
  if (signal.pw !== pw) {
    throw new Error("Sandi sinkron tidak cocok dengan HP lain");
  }
}

export function waitForOpen(channel: RTCDataChannel): Promise<void> {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    channel.onopen = () => resolve();
    channel.onerror = () => reject(new Error("Koneksi gagal"));
  });
}

// Symmetric transfer: sends `payload` while receiving the peer's payload over the
// same data channel. Resolves with the peer's payload once BOTH directions finish.
// Every message is tagged (meta/chunk/ack/done/error) so the two directions do
// not collide on one channel.
export function exchange(
  channel: RTCDataChannel,
  payload: HistoryPayload,
  onProgress?: (percent: number) => void,
): Promise<HistoryPayload> {
  const text = JSON.stringify(payload);
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }

  return new Promise<HistoryPayload>((resolve, reject) => {
    let settled = false;
    let stopped = false;
    let expected = -1;
    let bytes = -1;
    let received: HistoryPayload | null = null;
    let peerDone = false;
    let shown = 0;
    const parts: string[] = [];
    let timer: ReturnType<typeof setTimeout>;

    const advance = (percent: number) => {
      if (percent > shown) {
        shown = percent;
        onProgress?.(percent);
      }
    };
    const safeSend = (message: SyncMessage) => {
      if (channel.readyState === "open") channel.send(JSON.stringify(message));
    };
    const cleanup = () => {
      stopped = true;
      clearTimeout(timer);
      channel.removeEventListener("message", onMessage);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      safeSend({ t: "error", message });
      cleanup();
      reject(new Error(message));
    };
    const resetStall = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fail("Koneksi macet, coba lagi"), STALL_MS);
    };
    const maybeResolve = () => {
      if (settled || !received || !peerDone) return;
      settled = true;
      cleanup();
      advance(100);
      resolve(received);
    };
    const finishReceive = () => {
      if (settled) return;
      const joined = parts.join("");
      // ponytail: SCTP data channels are ordered+reliable, so a length check
      // catches truncation; add a hash only if corruption is ever observed.
      if (bytes >= 0 && joined.length !== bytes) {
        fail("Data sinkron rusak");
        return;
      }
      try {
        received = JSON.parse(joined) as HistoryPayload;
      } catch {
        fail("Data sinkron rusak");
        return;
      }
      safeSend({ t: "done" });
      maybeResolve();
    };

    const onMessage = (event: MessageEvent) => {
      if (settled) return;
      resetStall();
      const msg = parseMessage(event.data);
      if (!msg) return;
      switch (msg.t) {
        case "meta":
          if (typeof msg.chunks === "number") {
            expected = msg.chunks;
            bytes = typeof msg.bytes === "number" ? msg.bytes : -1;
            if (expected === 0) finishReceive();
          }
          break;
        case "chunk": {
          if (expected < 0) break;
          parts.push(msg.d ?? "");
          const got = parts.length;
          if (got % ACK_EVERY === 0) safeSend({ t: "ack", got });
          advance(Math.min(99, Math.round((got / expected) * 100)));
          if (got >= expected) finishReceive();
          break;
        }
        case "ack":
          if (typeof msg.got === "number") {
            advance(Math.min(99, Math.round((msg.got / chunks.length) * 100)));
          }
          break;
        case "done":
          peerDone = true;
          maybeResolve();
          break;
        case "error":
          fail(msg.message || "Penerima gagal menyimpan data");
          break;
      }
    };

    channel.addEventListener("message", onMessage);
    channel.onerror = () => fail("Koneksi gagal");
    channel.onclose = () => {
      if (!settled) reject(new Error("Koneksi terputus"));
    };
    resetStall();

    safeSend({ t: "meta", bytes: text.length, chunks: chunks.length });
    void (async () => {
      for (const chunk of chunks) {
        if (stopped) return;
        await waitForBuffer(channel);
        channel.send(JSON.stringify({ t: "chunk", d: chunk }));
      }
    })().catch((error) => {
      fail(error instanceof Error ? error.message : "Gagal mengirim");
    });
  });
}

function waitForBuffer(channel: RTCDataChannel): Promise<void> {
  if (channel.bufferedAmount < BUFFER_HIGH) return Promise.resolve();
  channel.bufferedAmountLowThreshold = BUFFER_LOW;
  return new Promise((resolve) => {
    channel.addEventListener("bufferedamountlow", () => resolve(), {
      once: true,
    });
  });
}
