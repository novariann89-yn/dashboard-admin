import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual, signValue } from "./pin";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function getSecret(): string {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

export function createSessionToken(now = Date.now()): string {
  const exp = String(now + SESSION_TTL_MS);
  return `${exp}.${signValue(exp, getSecret())}`;
}

export function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const [exp, signature] = token.split(".");
  if (!exp || !signature) return false;
  if (!safeEqual(signature, signValue(exp, getSecret()))) return false;
  const expMs = Number(exp);
  return Number.isFinite(expMs) && expMs > now;
}

export async function getSession(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export async function requireSession(): Promise<void> {
  if (!(await getSession())) redirect("/login");
}

export async function setSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}