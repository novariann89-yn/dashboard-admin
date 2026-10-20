"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

type ScannerStatus =
  | "starting"
  | "scanning"
  | "no-decoder"
  | "insecure"
  | "denied";

const STATUS_MESSAGE: Record<ScannerStatus, string> = {
  starting: "Menyalakan kamera...",
  scanning: "Arahkan kamera ke kode QR di HP lain.",
  "no-decoder":
    "Browser ini tidak bisa memindai QR (coba Chrome/Brave). Pakai kode manual di bawah.",
  insecure:
    "Kamera butuh HTTPS tepercaya. Pakai kode manual di bawah.",
  denied: "Izin kamera ditolak. Pakai kode manual di bawah.",
};

export function QrScanner({
  onResult,
  pasteLabel = "masukkan kode manual",
}: {
  onResult: (value: string) => void;
  pasteLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<ScannerStatus>("starting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let detector: BarcodeDetectorLike | null = null;
    let done = false;

    const Ctor = (
      window as unknown as {
        BarcodeDetector?: new (opts?: unknown) => BarcodeDetectorLike;
      }
    ).BarcodeDetector;

    async function start() {
      if (!Ctor) {
        setStatus("no-decoder");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus(window.isSecureContext ? "no-decoder" : "insecure");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setStatus("denied");
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      detector = new Ctor({ formats: ["qr_code"] });
      setStatus("scanning");

      const tick = async () => {
        if (done || !video || !detector) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0 && codes[0].rawValue) {
            done = true;
            onResultRef.current(codes[0].rawValue);
            return;
          }
        } catch {}
        raf = requestAnimationFrame(() => void tick());
      };
      void tick();
    }

    void start();
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setManual(text.trim());
    } catch {}
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <video
        ref={videoRef}
        playsInline
        muted
        className="h-56 w-56 rounded-control border border-line bg-black object-cover"
      />
      <p
        className={`text-xs ${status === "scanning" || status === "starting" ? "text-ink-soft" : "text-error"}`}
      >
        {STATUS_MESSAGE[status]}
      </p>

      <details className="w-full" open={status !== "scanning"}>
        <summary className="cursor-pointer text-xs font-bold text-primary">
          Masukkan kode manual
        </summary>
        <p className="mt-1 text-[11px] text-ink-soft">{pasteLabel}</p>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            rows={3}
            placeholder="Tempel kode dari HP lain"
            className="w-full rounded-control border border-line bg-surface p-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="flex-1 rounded-control border-2 border-line py-2 text-sm font-bold text-ink"
            >
              Tempel
            </button>
            <button
              type="button"
              onClick={() => manual.trim() && onResult(manual)}
              className="flex-1 rounded-control bg-primary py-2 text-sm font-bold text-white"
            >
              Pakai kode ini
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
