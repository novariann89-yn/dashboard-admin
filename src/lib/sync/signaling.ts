export interface SignalData {
  sdp: RTCSessionDescriptionInit;
  pw: string;
  v: number;
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function encodeSignal(data: SignalData): Promise<string> {
  const json = JSON.stringify(data);
  const compressed = await deflate(new TextEncoder().encode(json));
  return bytesToBase64(compressed);
}

export async function decodeSignal(text: string): Promise<SignalData> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Kode kosong");
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(trimmed);
  } catch {
    throw new Error("Kode tidak valid");
  }
  const json = await inflate(bytes);
  return JSON.parse(json) as SignalData;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return await new Response(stream).text();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
