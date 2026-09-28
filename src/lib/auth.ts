import { randomSalt, hashPin as hashPassword, verifyPin as verifyPassword } from "./pin";
import { getDb } from "./db";
import type { User } from "./types";

const SESSION_KEY = "toko-session";

export interface Session {
  userId: string;
  username: string;
  role: "owner" | "admin";
  permissions: string[];
}

export async function login(username: string, password: string): Promise<Session | null> {
  const db = getDb();
  const user = await db.users.where("username").equals(username).first();
  if (!user || !user.active) return null;
  const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!valid) return null;
  const session: Session = {
    userId: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const user = await db.users.get(userId);
  if (!user) return { ok: false, error: "User tidak ditemukan" };
  const valid = await verifyPassword(oldPassword, user.passwordSalt, user.passwordHash);
  if (!valid) return { ok: false, error: "Sandi lama salah" };
  const salt = randomSalt();
  const hash = await hashPassword(newPassword, salt);
  await db.users.update(userId, { passwordSalt: salt, passwordHash: hash });
  return { ok: true };
}

export async function createUser(input: {
  username: string;
  password: string;
  role: "owner" | "admin";
  permissions?: string[];
}): Promise<User> {
  const db = getDb();
  const salt = randomSalt();
  const hash = await hashPassword(input.password, salt);
  const user: User = {
    id: crypto.randomUUID(),
    username: input.username,
    passwordHash: hash,
    passwordSalt: salt,
    role: input.role,
    permissions: input.permissions ?? (input.role === "owner" ? ["*"] : ["beranda", "pelanggan", "stok"]),
    active: true,
    createdAt: Date.now(),
  };
  await db.users.add(user);
  return user;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "role" | "permissions" | "active">>
): Promise<void> {
  await getDb().users.update(id, patch);
}

export async function deleteUser(id: string): Promise<void> {
  await getDb().users.delete(id);
}