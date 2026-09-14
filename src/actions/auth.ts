"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth";
import { verifyPin } from "@/lib/pin";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 20;

let attempts: { count: number; since: number } = { count: 0, since: 0 };

function tooManyAttempts(now = Date.now()): boolean {
  if (now - attempts.since > WINDOW_MS) {
    attempts = { count: 0, since: now };
  }
  return attempts.count >= MAX_ATTEMPTS;
}

export async function loginAction(formData: FormData): Promise<void> {
  const pin = String(formData.get("pin") ?? "").trim();

  if (tooManyAttempts()) {
    redirect("/login?error=terlalu-banyak");
  }

  if (!pin || !verifyPin(pin)) {
    attempts.count += 1;
    if (attempts.since === 0) attempts.since = Date.now();
    redirect("/login?error=1");
  }

  attempts = { count: 0, since: 0 };
  await setSessionCookie();
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
