"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconBottle, IconEye, IconEyeOff, IconLock, IconUser } from "@/components/icons";
import { login, getSession, logout as doLogout } from "@/lib/auth";
import {
  ensureSeeded,
  DEFAULT_OWNER_USERNAME,
  DEFAULT_OWNER_PASSWORD,
} from "@/lib/seed";
import { useRouter } from "next/navigation";
import { useAppName } from "@/lib/use-app-name";

type Stage = "loading" | "login" | "unlocked";

export function LoginGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const appName = useAppName();
  const [stage, setStage] = useState<"loading" | "login" | "unlocked">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      if (cancelled) return;
      const session = getSession();
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
      return;
    }
    setStage("unlocked");
    router.refresh();
  }

  function handleLogout() {
    doLogout();
    setStage("login");
    router.refresh();
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-card bg-primary shadow-card">
          <IconBottle className="h-8 w-8 text-white" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{appName}</h1>
        <p className="text-sm text-ink-soft">Masukkan ID dan Sandi</p>
      </div>

      {error && (
        <p className="text-center text-sm font-bold text-error" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-bold text-ink-soft">
            ID
          </label>
          <div className="relative">
            <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-soft" />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan ID"
              autoComplete="username"
              className="w-full rounded-control border border-line bg-surface px-10 py-3 text-base font-medium transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-bold text-ink-soft">
            Sandi
          </label>
          <div className="relative">
            <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-soft" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan Sandi"
              autoComplete="current-password"
              className="w-full rounded-control border border-line bg-surface px-10 py-3 pr-12 text-base font-medium transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
              aria-label={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
            >
              {showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          disabled={!username.trim() || !password}
          className="rounded-control bg-primary py-3.5 text-base font-extrabold text-white shadow-soft transition hover:bg-primary-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Masuk
        </button>
      </div>

      <p className="text-center text-xs text-ink-soft">
        ID default: <code className="font-mono text-primary">{DEFAULT_OWNER_USERNAME}</code>
        · Sandi default: <code className="font-mono text-primary">{DEFAULT_OWNER_PASSWORD}</code>
      </p>
    </div>
  );
}