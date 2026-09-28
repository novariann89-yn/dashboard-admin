"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconBottle, IconDelete, IconLock, IconUser } from "@/components/icons";
import { verifyPin as verifyPassword } from "@/lib/pin";
import { ensureSeeded } from "@/lib/seed";
import { getSettings, updateSettings } from "@/lib/settings";
import { login, getSession, logout } from "@/lib/auth";

type Stage = "loading" | "login" | "unlocked";

const SESSION_KEY = "toko-session";

export function LoginGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      const session = getSession();
      if (cancelled) return;
      if (session) {
        setStage("unlocked");
      } else {
        setStage("login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin() {
    setError(null);
    if (!username.trim() || !password) {
      setError("ID dan Sandi wajib diisi");
      return;
    }
    const session = await login(username.trim(), password);
    if (!session) {
      setError("ID atau Sandi salah");
      setPassword("");
      return;
    }
    setStage("unlocked");
  }

  async function handleLogout() {
    logout();
    setStage("login");
    setUsername("");
    setPassword("");
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">
        Memuat...
      </div>
    );
  }

  if (stage === "unlocked") {
    return (
      <>
        {children}
        <button
          onClick={handleLogout}
          className="no-print fixed bottom-4 right-4 z-50 rounded-control border-2 border-primary bg-primary text-white px-3 py-1.5 text-xs font-bold shadow-card"
        >
          Keluar
        </button>
      </>
    );
  }

  const currentSession = getSession();
  const userRole = currentSession?.role ?? "admin";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-card bg-gradient-primary shadow-card">
          <IconBottle className="h-8 w-8 text-white" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-gradient-primary">Dashboard Admin</h1>
        <p className="text-sm text-ink-soft">
          {currentSession
            ? `Masuk sebagai ${currentSession.username} (${currentSession.role})`
            : "Masukkan ID dan Sandi"}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-soft" />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ID"
            className="w-full rounded-control border-2 border-line bg-surface px-10 py-3 text-base font-bold text-ink"
            autoFocus
          />
        </div>
        <div className="relative">
          <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-soft" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sandi"
            className="w-full rounded-control border-2 border-line bg-surface px-10 py-3 text-base font-bold text-ink"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft"
          >
            {showPassword ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>

        {error && (
          <p className="text-center text-sm font-bold text-error">{error}</p>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={!username.trim() || !password}
          className="rounded-control border-2 bg-gradient-primary text-white py-3 text-sm font-extrabold shadow-card disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Masuk
        </button>

        <p className="text-center text-xs text-ink-soft">
          Default: <code className="font-bold">owner</code> / <code className="font-bold">1234</code>
        </p>
      </div>
    </div>
  );
}

export { LoginGate as PinGate };