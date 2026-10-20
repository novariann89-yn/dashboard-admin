"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { QrCode } from "@/components/qr-code";
import { QrScanner } from "@/components/qr-scan";
import {
  badgeClass,
  buttonClass,
  cardClass,
  inputClass,
  sectionLabelClass,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getSettings, updateSettings } from "@/lib/settings";
import { hashPassword } from "@/lib/sync/signaling";
import {
  applyHistoryPayload,
  buildHistoryPayload,
  isHistoryPayload,
  SYNC_VERSION,
  type MergeSummary,
} from "@/lib/sync/payload";
import {
  connectionHash,
  exchange,
  finishSender,
  parseIceServers,
  startReceiver,
  startSender,
  waitForOpen,
  type ReceiverSession,
  type SenderSession,
} from "@/lib/sync/webrtc";

type Phase =
  | "idle"
  | "send-offer"
  | "send-scan"
  | "recv-scan"
  | "recv-answer"
  | "syncing"
  | "done";

interface Diag {
  webRTC: boolean;
  connState: string;
  iceState: string;
  bytes: number;
  fingerprint: string;
  lastSync: number;
}

function ManualCode({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <details className="w-full">
      <summary className="cursor-pointer text-xs font-bold text-primary">
        Tampilkan {label} (manual)
      </summary>
      <textarea
        readOnly
        value={value}
        rows={3}
        onFocus={(event) => event.target.select()}
        className="mt-2 w-full rounded-control border border-line bg-surface p-2 text-[10px]"
      />
      <button
        type="button"
        onClick={copy}
        className="mt-2 w-full rounded-control border-2 border-line py-1.5 text-[11px] font-bold text-ink"
      >
        {copied ? "Tersalin ✓" : "Salin kode ini"}
      </button>
    </details>
  );
}

export function SyncSection() {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [qrValue, setQrValue] = useState("");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<MergeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iceText, setIceText] = useState("");
  const [diag, setDiag] = useState<Diag>(() => ({
    webRTC: typeof RTCPeerConnection !== "undefined",
    connState: "",
    iceState: "",
    bytes: 0,
    fingerprint: "",
    lastSync: 0,
  }));

  const senderRef = useRef<SenderSession | null>(null);
  const receiverRef = useRef<ReceiverSession | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    getSettings().then((settings) => {
      setIceText(settings.iceServers);
      setDiag((d) => ({ ...d, lastSync: settings.lastSyncedAt }));
    });
  }, []);

  const reset = useCallback(() => {
    senderRef.current?.pc.close();
    receiverRef.current?.pc.close();
    senderRef.current = null;
    receiverRef.current = null;
    busyRef.current = false;
    setPhase("idle");
    setQrValue("");
    setProgress(0);
    setSummary(null);
    setError(null);
  }, []);

  function fail(error: unknown, prefix: string) {
    const message = error instanceof Error ? error.message : prefix;
    senderRef.current?.pc.close();
    receiverRef.current?.pc.close();
    senderRef.current = null;
    receiverRef.current = null;
    setError(message);
    setPhase("idle");
    toast(`${prefix}: ${message}`, "error");
  }

  function requirePassword(): string | null {
    const pw = password.trim();
    if (pw.length < 4) {
      toast("Sandi sinkron minimal 4 karakter", "error");
      return null;
    }
    return pw;
  }

  async function saveIce() {
    await updateSettings({ iceServers: iceText.trim() });
    toast("Pengaturan STUN/TURN disimpan");
  }

  async function runSync(pc: RTCPeerConnection, channel: RTCDataChannel) {
    setPhase("syncing");
    const onState = () =>
      setDiag((d) => ({
        ...d,
        connState: pc.connectionState,
        iceState: pc.iceConnectionState,
        fingerprint: connectionHash(pc),
      }));
    pc.addEventListener("connectionstatechange", onState);
    pc.addEventListener("iceconnectionstatechange", onState);
    onState();
    try {
      const mine = await buildHistoryPayload();
      const theirs = await exchange(channel, mine, setProgress);
      if (!isHistoryPayload(theirs)) {
        throw new Error("Versi data beda — perbarui aplikasi di kedua HP");
      }
      setSummary(await applyHistoryPayload(theirs));
      const now = Date.now();
      await updateSettings({ lastSyncedAt: now });
      setDiag((d) => ({
        ...d,
        bytes: JSON.stringify(mine).length,
        lastSync: now,
        fingerprint: connectionHash(pc),
      }));
      toast("Sinkron selesai");
      setPhase("done");
    } finally {
      pc.removeEventListener("connectionstatechange", onState);
      pc.removeEventListener("iceconnectionstatechange", onState);
    }
  }

  async function startSend() {
    const pw = requirePassword();
    if (!pw) return;
    setError(null);
    setSummary(null);
    try {
      const session = await startSender(
        await hashPassword(pw),
        parseIceServers(iceText),
      );
      senderRef.current = session;
      setQrValue(session.code);
      setPhase("send-offer");
    } catch (e) {
      fail(e, "Gagal memulai");
    }
  }

  async function senderScanned(answerCode: string) {
    const session = senderRef.current;
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      await finishSender(session, answerCode, await hashPassword(password.trim()));
      await waitForOpen(session.channel);
      await runSync(session.pc, session.channel);
    } catch (e) {
      fail(e, "Gagal menyinkron");
    } finally {
      busyRef.current = false;
    }
  }

  async function startReceive() {
    if (!requirePassword()) return;
    setError(null);
    setSummary(null);
    setPhase("recv-scan");
  }

  async function receiverScanned(offerCode: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      const session = await startReceiver(
        offerCode,
        await hashPassword(password.trim()),
        parseIceServers(iceText),
      );
      receiverRef.current = session;
      setQrValue(session.answerCode);
      setPhase("recv-answer");
      const channel = await session.channel;
      await waitForOpen(channel);
      await runSync(session.pc, channel);
    } catch (e) {
      fail(e, "Gagal menyinkron");
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Sinkron HP</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Sinkron dua arah lewat WiFi yang sama — tanpa internet. Kedua HP
        bertukar data lalu masing-masing menyatukannya. Buka aplikasi ini di
        kedua HP dengan sandi yang sama.
      </p>

      {phase === "idle" && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft">
            Sandi sinkron
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sandi yang sama di kedua HP"
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={startSend} className={buttonClass}>
              Tampilkan kode
            </button>
            <button
              type="button"
              onClick={startReceive}
              className={`${buttonClass} bg-ink`}
            >
              Scan kode
            </button>
          </div>
          <p className="text-[11px] text-ink-soft">
            Pilih <b>Tampilkan kode</b> di satu HP, lalu <b>Scan kode</b> di HP
            satunya.
          </p>
        </div>
      )}

      {phase === "send-offer" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            Langkah 1: minta HP satunya tap &quot;Scan kode&quot; lalu pindai
            kode ini.
          </p>
          <QrCode value={qrValue} />
          <ManualCode label="Kode 1 (pengirim)" value={qrValue} />
          <button
            type="button"
            onClick={() => setPhase("send-scan")}
            className={buttonClass}
          >
            Lanjut: scan balasan
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-[11px] font-bold text-error underline"
          >
            Batal
          </button>
        </div>
      )}

      {phase === "send-scan" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            Langkah 2: pindai kode balasan dari HP satunya.
          </p>
          <QrScanner
            onResult={senderScanned}
            pasteLabel="Tempel Kode 2 (balasan) dari HP satunya."
          />
          <button
            type="button"
            onClick={reset}
            className="text-[11px] font-bold text-error underline"
          >
            Batal
          </button>
        </div>
      )}

      {phase === "recv-scan" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            Langkah 1: pindai kode dari HP yang menampilkan kode.
          </p>
          <QrScanner
            onResult={receiverScanned}
            pasteLabel="Tempel Kode 1 (pengirim) dari HP satunya."
          />
          <button
            type="button"
            onClick={reset}
            className="text-[11px] font-bold text-error underline"
          >
            Batal
          </button>
        </div>
      )}

      {phase === "recv-answer" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            Langkah 2: minta HP satunya pindai kode balasan ini.
          </p>
          <QrCode value={qrValue} />
          <ManualCode label="Kode 2 (balasan)" value={qrValue} />
          <p className="text-xs text-ink-soft">Menunggu tersambung...</p>
          <button
            type="button"
            onClick={reset}
            className="text-[11px] font-bold text-error underline"
          >
            Batal
          </button>
        </div>
      )}

      {phase === "syncing" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">Menyinkronkan data...</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs tabular-nums text-ink-soft">{progress}%</p>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm font-bold text-success">Selesai.</p>
          {diag.fingerprint && (
            <p className="text-xs text-ink-soft">
              Kode koneksi:{" "}
              <b className="tabular-nums">{diag.fingerprint}</b>
              <span className="block text-[10px]">
                Harus sama persis di kedua HP.
              </span>
            </p>
          )}
          {summary && (
            <ul className="text-xs text-ink-soft">
              <li>Transaksi baru: {summary.transactions}</li>
              <li>Pengeluaran baru: {summary.expenses}</li>
              <li>Member baru/berubah: {summary.customers}</li>
              <li>Klaim loyalitas: {summary.loyaltyClaims}</li>
              <li>Produk/varian baru: {summary.products + summary.variants}</li>
              <li>Dihapus: {summary.deleted}</li>
              <li>Dilewati (sudah ada): {summary.skipped}</li>
            </ul>
          )}
          <button type="button" onClick={reset} className={buttonClass}>
            Selesai
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-bold text-error">{error}</p>}

      <details className="mt-3 border-t border-line pt-2">
        <summary className="cursor-pointer text-[11px] font-bold text-primary">
          Diagnostik
        </summary>
        <ul className="mt-1 text-[10px] text-ink-soft">
          <li>WebRTC: {diag.webRTC ? "didukung" : "tidak didukung"}</li>
          <li>Versi sinkron: {SYNC_VERSION}</li>
          <li>Koneksi: {diag.connState || "-"}</li>
          <li>ICE: {diag.iceState || "-"}</li>
          <li>
            Ukuran data terakhir:{" "}
            {diag.bytes ? `${Math.round(diag.bytes / 1024)} KB` : "-"}
          </li>
          <li>
            Terakhir sinkron:{" "}
            {diag.lastSync ? formatDateTime(diag.lastSync) : "belum pernah"}
          </li>
        </ul>
      </details>

      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-bold text-primary">
          Pengaturan lanjutan (STUN/TURN)
        </summary>
        <p className="mt-1 text-[10px] text-ink-soft">
          Kosongkan untuk mode WiFi lokal (bawaan). Isi JSON daftar server ICE
          kalau router memisahkan antar HP. Contoh:{" "}
          <code>{`[{"urls":"stun:stun.example.org:3478"}]`}</code>
        </p>
        <textarea
          value={iceText}
          onChange={(event) => setIceText(event.target.value)}
          rows={3}
          placeholder='[{"urls":"stun:..."}]'
          className={`${inputClass} mt-2 text-[10px]`}
        />
        <button type="button" onClick={saveIce} className={`${badgeClass} mt-2`}>
          Simpan
        </button>
      </details>
    </section>
  );
}
