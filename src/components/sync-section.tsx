"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { QrCode } from "@/components/qr-code";
import { QrScanner } from "@/components/qr-scan";
import { buttonClass, cardClass, inputClass, sectionLabelClass } from "@/components/ui";
import { hashPassword } from "@/lib/sync/signaling";
import {
  applyHistoryPayload,
  buildHistoryPayload,
  isHistoryPayload,
  type MergeSummary,
} from "@/lib/sync/payload";
import {
  finishSender,
  receivePayload,
  sendPayload,
  startReceiver,
  startSender,
  waitForOpen,
  type ReceiverSession,
  type SenderSession,
} from "@/lib/sync/webrtc";

type Phase =
  | "idle"
  | "sender-offer"
  | "sender-answer"
  | "sender-transfer"
  | "receiver-scan"
  | "receiver-answer"
  | "receiver-transfer"
  | "done";

function ManualCode({ value }: { value: string }) {
  return (
    <details className="w-full">
      <summary className="cursor-pointer text-xs font-bold text-primary">
        Tampilkan kode manual
      </summary>
      <textarea
        readOnly
        value={value}
        rows={3}
        onFocus={(event) => event.target.select()}
        className="mt-2 w-full rounded-control border border-line bg-surface p-2 text-[10px]"
      />
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

  const senderRef = useRef<SenderSession | null>(null);
  const receiverRef = useRef<ReceiverSession | null>(null);

  const reset = useCallback(() => {
    senderRef.current?.pc.close();
    receiverRef.current?.pc.close();
    senderRef.current = null;
    receiverRef.current = null;
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

  async function startSend() {
    const pw = requirePassword();
    if (!pw) return;
    setError(null);
    setSummary(null);
    try {
      const session = await startSender(await hashPassword(pw));
      senderRef.current = session;
      setQrValue(session.code);
      setPhase("sender-offer");
    } catch (e) {
      fail(e, "Gagal memulai");
    }
  }

  async function senderScanned(answerCode: string) {
    const session = senderRef.current;
    if (!session) return;
    setError(null);
    setPhase("sender-transfer");
    try {
      await finishSender(session, answerCode, await hashPassword(password.trim()));
      await waitForOpen(session.channel);
      await sendPayload(session.channel, await buildHistoryPayload(), setProgress);
      toast("Data terkirim");
      setPhase("done");
    } catch (e) {
      fail(e, "Gagal mengirim");
    }
  }

  async function startReceive() {
    if (!requirePassword()) return;
    setError(null);
    setSummary(null);
    setPhase("receiver-scan");
  }

  async function receiverScanned(offerCode: string) {
    setError(null);
    try {
      const session = await startReceiver(
        offerCode,
        await hashPassword(password.trim()),
      );
      receiverRef.current = session;
      setQrValue(session.answerCode);
      setPhase("receiver-answer");
      const channel = await session.channel;
      await waitForOpen(channel);
      setPhase("receiver-transfer");
      const payload = await receivePayload(channel, setProgress);
      if (!isHistoryPayload(payload)) {
        throw new Error("Data sinkron tidak dikenal");
      }
      setSummary(await applyHistoryPayload(payload));
      toast("Data diterima");
      setPhase("done");
    } catch (e) {
      fail(e, "Gagal menerima");
    }
  }

  const busy =
    phase === "sender-transfer" || phase === "receiver-transfer";

  return (
    <section className={cardClass}>
      <h2 className={sectionLabelClass}>Sinkron HP</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Kirim riwayat (penjualan, pengeluaran, member) ke HP lain lewat WiFi
        yang sama — tanpa internet. Kedua HP harus membuka aplikasi ini dan
        memakai sandi yang sama.
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
              Kirim data
            </button>
            <button
              type="button"
              onClick={startReceive}
              className={`${buttonClass} bg-ink`}
            >
              Terima data
            </button>
          </div>
        </div>
      )}

      {phase === "sender-offer" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            Langkah 1: minta HP penerima scan kode ini.
          </p>
          <QrCode value={qrValue} />
          <ManualCode value={qrValue} />
          <button
            type="button"
            onClick={() => setPhase("sender-answer")}
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

      {phase === "sender-answer" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            Langkah 2: scan kode balasan dari HP penerima.
          </p>
          <QrScanner onResult={senderScanned} />
          <button
            type="button"
            onClick={reset}
            className="text-[11px] font-bold text-error underline"
          >
            Batal
          </button>
        </div>
      )}

      {phase === "receiver-scan" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            Langkah 1: scan kode dari HP pengirim.
          </p>
          <QrScanner onResult={receiverScanned} />
          <button
            type="button"
            onClick={reset}
            className="text-[11px] font-bold text-error underline"
          >
            Batal
          </button>
        </div>
      )}

      {phase === "receiver-answer" && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            Langkah 2: minta HP pengirim scan kode balasan ini.
          </p>
          <QrCode value={qrValue} />
          <ManualCode value={qrValue} />
          <p className="text-xs text-ink-soft">Menunggu data masuk...</p>
          <button
            type="button"
            onClick={reset}
            className="text-[11px] font-bold text-error underline"
          >
            Batal
          </button>
        </div>
      )}

      {busy && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-xs font-bold">
            {phase === "sender-transfer"
              ? "Mengirim data..."
              : "Menerima data..."}
          </p>
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
          {summary && (
            <ul className="text-xs text-ink-soft">
              <li>Transaksi baru: {summary.transactions}</li>
              <li>Pengeluaran baru: {summary.expenses}</li>
              <li>Member baru: {summary.customers}</li>
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
    </section>
  );
}
