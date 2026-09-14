export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("62")) {
    digits = "0" + digits.slice(2);
  } else if (digits.startsWith("8")) {
    digits = "0" + digits;
  }

  if (!/^08\d{7,12}$/.test(digits)) return null;
  return digits;
}

export function formatPhone(phone: string): string {
  const p = normalizePhone(phone) ?? phone;
  if (!/^08\d{7,12}$/.test(p)) return p;
  return [p.slice(0, 4), p.slice(4, 8), p.slice(8)].filter(Boolean).join("-");
}