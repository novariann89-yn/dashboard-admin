"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconBottle, IconDelete } from "@/components/icons";
import { hashPin, isValidPin, randomSalt, verifyPin } from "@/lib/pin";
import { ensureSeeded, DEFAULT_PIN } from "@/lib/seed";
import { getSettings, updateSettings } from "@/lib/settings";

type Stage = "loading" | "setup" | "locked" | "unlocked";

const UNLOCK_KEY = "toko-unlocked";

export function PinGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pinIsDefault, setPinIsDefault] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      const settings = await getSettings();
      if (cancelled) return;

      setPinIsDefault(settings.pinIsDefault);
      if (!settings.pinHash || !settings.pinSalt) {
        setStage("setup");
      } else if (sessionStorage.getItem(UNLOCK_KEY) === "1") {
        setStage("unlocked");
      } else {
        setStage("locked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSetup() {
    setError(null);
    if (!isValidPin(pin)) {
      setError("PIN harus 4 angka");
      return;
    }
    if (pin !== confirmPin) {
      setError("Ulangi PIN tidak sama");
      return;
    }
    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    await updateSettings({ pinSalt: salt, pinHash: hash, pinIsDefault: false });
    sessionStorage.setItem(UNLOCK_KEY, "1");
    setStage("unlocked");
  }

  async function handleUnlock() {
    setError(null);
    const settings = await getSettings();
    if (!settings.pinHash || !settings.pinSalt) {
      setStage("setup");
      return;
    }
    const valid = await verifyPin(pin, settings.pinSalt, settings.pinHash);
    if (!valid) {
      setError("PIN salah");
      setPin("");
      return;
    }
    sessionStorage.setItem(UNLOCK_KEY, "1");
    setStage("unlocked");
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">
        Memuat...
      </div>
    );
  }

  if (stage === "unlocked") {
    return <>{children}</>;
  }

  const setup = stage === "setup";
  const activePin = setup && pin.length === 4 ? confirmPin : pin;

  function pressDigit(digit: string) {
    setError(null);
    if (setup && pin.length === 4) {
      if (confirmPin.length < 4) setConfirmPin(confirmPin + digit);
      return;
    }
    if (pin.length < 4) setPin(pin + digit);
  }

  function backspace() {
    setError(null);
    if (setup && pin.length === 4) {
      setConfirmPin(confirmPin.slice(0, -1));
      return;
    }
    setPin(pin.slice(0, -1));
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-card border-2 border-ink bg-soy shadow-hard-sm">
          <IconBottle className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Dashboard Admin</h1>
        <p className="text-sm text-ink-soft">
          {setup
            ? pin.length < 4
              ? "Buat PIN 4 angka"
              : "Ulangi PIN"
            : "Masukkan PIN untuk membuka"}
        </p>
      </div>

      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-4 w-4 rounded-full border-2 border-ink ${
              index < activePin.length ? "bg-soy" : "bg-surface"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-center text-sm font-bold text-brick">{error}</p>
      )}

      {!setup && pinIsDefault && (
        <p className="text-center text-xs text-ink-soft">
          PIN awal: {DEFAULT_PIN}. Ganti di Setting setelah masuk.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => pressDigit(digit)}
            className="rounded-control border-2 border-ink bg-surface py-4 text-xl font-extrabold shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={backspace}
          className="flex items-center justify-center rounded-control border-2 border-ink bg-cream py-4 shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          aria-label="Hapus"
        >
          <IconDelete className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => pressDigit("0")}
          className="rounded-control border-2 border-ink bg-surface py-4 text-xl font-extrabold shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          0
        </button>
        <button
          type="button"
          onClick={setup ? handleSetup : handleUnlock}
          disabled={activePin.length !== 4}
          className="rounded-control border-2 border-ink bg-soy py-4 text-sm font-extrabold shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
        >
          {setup ? (pin.length < 4 ? "Lanjut" : "Simpan") : "Buka"}
        </button>
      </div>
    </div>
  );
}