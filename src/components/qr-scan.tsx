"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

type ScannerStatus =
  | "starting"
  | "scanning"
  | "unsupported"
  | "denied";

export function QrScanner({ onResult }: { onResult: (value: string) => void }) {
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
      if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
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

  return (
    <div className="flex flex-col items-center gap-2">
      <video
        ref={videoRef}
        playsInline
        muted
        className="h-56 w-56 rounded-control border border-line bg-black object-cover"
      />
      {status === "scanning" && (
        <p className="text-xs text-ink-soft">Arahkan kamera ke QR di HP lain.</p>
      )}
      {status === "starting" && (
        <p className="text-xs text-ink-soft">Menyalakan kamera...</p>
      )}
      {(status === "unsupported" || status === "denied") && (
        <p className="text-xs text-error">
          Kamera tidak bisa dipakai. Masukkan kode manual di bawah.
        </p>
      )}

      <details className="w-full">
        <summary className="cursor-pointer text-xs font-bold text-primary">
          Masukkan kode manual
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            rows={3}
            placeholder="Tempel kode dari HP lain"
            className="w-full rounded-control border border-line bg-surface p-2 text-xs"
          />
          <button
            type="button"
            onClick={() => manual.trim() && onResult(manual)}
            className="rounded-control bg-primary py-2 text-sm font-bold text-white"
          >
            Pakai kode ini
          </button>
        </div>
      </details>
    </div>
  );
}
