export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyPin(
  pin: string,
  salt: string,
  hash: string,
): Promise<boolean> {
  if (!salt || !hash) return false;
  const computed = await hashPin(pin, salt);
  return computed === hash;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}