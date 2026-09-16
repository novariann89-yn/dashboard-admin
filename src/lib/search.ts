import type { Customer } from "./types";

const TITLES = new Set([
  "pak",
  "bu",
  "bpk",
  "ibu",
  "mas",
  "mbak",
  "mbok",
  "kang",
  "haji",
  "hj",
  "h",
]);

const NAME_VARIANTS: Record<string, string> = {
  muhammad: "muhammad",
  muhamad: "muhammad",
  mohammad: "muhammad",
  mohamad: "muhammad",
  moh: "muhammad",
  m: "muhammad",
  achmad: "ahmad",
  ahmad: "ahmad",
  syarif: "syarif",
  sarif: "syarif",
};

function applySpellingVariants(token: string): string {
  return token
    .replace(/dj/g, "j")
    .replace(/tj/g, "c")
    .replace(/oe/g, "u");
}

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

export function normalizeName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  return cleaned
    .split(" ")
    .filter((token) => token && !TITLES.has(token))
    .map((token) => NAME_VARIANTS[token] ?? applySpellingVariants(token))
    .join(" ");
}

export function isPhoneLikeQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  return /^[+\d]/.test(trimmed);
}

export function phoneLast4(phone: string): string {
  return phone.slice(-4);
}

export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone) ?? phone;
  if (!/^08\d{7,12}$/.test(normalized)) return normalized;
  return [normalized.slice(0, 4), normalized.slice(4, 8), normalized.slice(8)]
    .filter(Boolean)
    .join("-");
}

export type RankedCustomer = { customer: Customer; score: number };

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous = current;
  }

  return previous[b.length];
}

export function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;

  const grams = (value: string) => {
    const set = new Set<string>();
    for (let index = 0; index <= value.length - 3; index += 1) {
      set.add(value.slice(index, index + 3));
    }
    return set;
  };

  const gramsA = grams(a);
  const gramsB = grams(b);
  let shared = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) shared += 1;
  }
  return (2 * shared) / (gramsA.size + gramsB.size);
}

export function fuzzyScore(query: string, name: string): number {
  if (query.length < 3 || name.length === 0) return 0;

  let best = 0;

  for (const word of name.split(" ")) {
    const distance = levenshtein(query, word);
    if (distance <= 2) best = Math.max(best, 69 - distance * 12);

    const similarity = trigramSimilarity(query, word);
    if (similarity >= 0.4) {
      best = Math.max(best, Math.round(40 + similarity * 29));
    }
  }

  const wholeSimilarity = trigramSimilarity(query, name);
  if (wholeSimilarity >= 0.4) {
    best = Math.max(best, Math.round(40 + wholeSimilarity * 29));
  }

  return Math.min(69, best);
}

function scoreName(query: string, customer: Customer): number {
  const name = customer.nameNormal;
  if (!name) return 0;
  if (name === query) return 100;

  const words = name.split(" ");
  if (name.startsWith(query)) return 90;
  if (words.some((word) => word.startsWith(query))) return 80;
  if (name.includes(query)) return 70;

  return fuzzyScore(query, name);
}

function scorePhone(query: string, customer: Customer): number {
  const phone = customer.phoneNormal;
  if (!phone) return 0;
  if (phone === query) return 100;
  if (query.length >= 4 && phone.endsWith(query)) return 85;
  if (query.length >= 4 && phone.includes(query)) return 70;
  return 0;
}

export function rankCustomers(
  query: string,
  customers: Customer[],
): RankedCustomer[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const phoneMode = isPhoneLikeQuery(trimmed);
  const phoneQuery = phoneMode ? normalizePhone(trimmed) : null;
  const nameQuery = phoneMode ? "" : normalizeName(trimmed);

  const ranked: RankedCustomer[] = [];

  for (const customer of customers) {
    let score = 0;

    if (phoneMode) {
      const digits = trimmed.replace(/\D/g, "");
      if (phoneQuery) {
        score = Math.max(score, scorePhone(phoneQuery, customer));
      }
      if (digits.length >= 4) {
        score = Math.max(score, scorePhone(digits, customer));
      }
      if (nameQuery) score = Math.max(score, scoreName(nameQuery, customer));
    } else {
      if (nameQuery) score = Math.max(score, scoreName(nameQuery, customer));
    }

    if (score > 0) ranked.push({ customer, score });
  }

  return ranked.sort(
    (a, b) => b.score - a.score || a.customer.name.localeCompare(b.customer.name),
  );
}

export function searchCustomers(
  query: string,
  customers: Customer[],
  limit = 5,
): RankedCustomer[] {
  return rankCustomers(query, customers).slice(0, limit);
}