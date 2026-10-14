"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "L",
      margin: 1,
      width: size,
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (failed) {
    return (
      <p className="text-xs text-error">
        Kode terlalu besar untuk QR. Pakai kode manual di bawah.
      </p>
    );
  }
  if (!src) {
    return (
      <div
        className="animate-pulse rounded-control bg-canvas"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Kode sinkron"
      width={size}
      height={size}
      className="rounded-control border border-line bg-white"
    />
  );
}
