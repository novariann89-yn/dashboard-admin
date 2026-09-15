import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPhoneLikeQuery,
  normalizeName,
  normalizePhone,
  phoneLast4,
  searchCustomers,
} from "./search";
import type { Customer } from "./types";

function customer(partial: Partial<Customer>): Customer {
  return {
    id: partial.id ?? partial.name ?? "id",
    type: "member",
    name: partial.name ?? "Tanpa Nama",
    nameNormal: normalizeName(partial.name ?? "Tanpa Nama"),
    phone: partial.phone ?? "081200000000",
    phoneNormal: normalizePhone(partial.phone ?? "081200000000") ?? "081200000000",
    address: null,
    note: null,
    resellerLevelId: null,
    suggestedPrice: null,
    joinedAt: 0,
    active: true,
    ...partial,
  };
}

describe("normalizePhone", () => {
  it("keeps canonical format", () => {
    assert.equal(normalizePhone("081234567890"), "081234567890");
  });

  it("converts +62, 62 and 8 prefixes", () => {
    assert.equal(normalizePhone("+6281234567890"), "081234567890");
    assert.equal(normalizePhone("6281234567890"), "081234567890");
    assert.equal(normalizePhone("81234567890"), "081234567890");
  });

  it("strips spaces and dashes", () => {
    assert.equal(normalizePhone("+62 812-3456-7890"), "081234567890");
  });

  it("rejects invalid input", () => {
    assert.equal(normalizePhone(""), null);
    assert.equal(normalizePhone("abc"), null);
    assert.equal(normalizePhone("0812345"), null);
    assert.equal(normalizePhone("0211234567"), null);
  });
});

describe("normalizeName", () => {
  it("lowercases and strips punctuation", () => {
    assert.equal(normalizeName("  BUDI, Santoso! "), "budi santoso");
  });

  it("removes titles", () => {
    assert.equal(normalizeName("Pak Budi"), "budi");
    assert.equal(normalizeName("Ibu Siti Aminah"), "siti aminah");
    assert.equal(normalizeName("Hj. Aminah"), "aminah");
  });

  it("unifies spelling variants", () => {
    assert.equal(normalizeName("Muhamad Rizki"), "muhammad rizki");
    assert.equal(normalizeName("Moh. Rizki"), "muhammad rizki");
    assert.equal(normalizeName("Achmad"), "ahmad");
    assert.equal(normalizeName("Sarif"), "syarif");
    assert.equal(normalizeName("Soeharto"), "suharto");
    assert.equal(normalizeName("Djamal"), "jamal");
    assert.equal(normalizeName("Tjandra"), "candra");
  });
});

describe("ranking", () => {
  const customers = [
    customer({ id: "1", name: "Budi Santoso", phone: "081234567890" }),
    customer({ id: "2", name: "Siti Aminah", phone: "081298765432" }),
    customer({ id: "3", name: "Shinta Dewi", phone: "081277778888" }),
  ];

  it("finds exact names first", () => {
    const results = searchCustomers("budi santoso", customers);
    assert.equal(results[0]?.customer.id, "1");
  });

  it("finds by word prefix", () => {
    const results = searchCustomers("sit", customers);
    assert.equal(results[0]?.customer.id, "2");
  });

  it("finds by phone last digits", () => {
    const results = searchCustomers("7890", customers);
    assert.equal(results[0]?.customer.id, "1");
  });

  it("finds by +62 phone format", () => {
    const results = searchCustomers("+62 812-3456-7890", customers);
    assert.equal(results[0]?.customer.id, "1");
  });

  it("returns nothing for empty query", () => {
    assert.equal(searchCustomers("", customers).length, 0);
  });
});

describe("phone helpers", () => {
  it("detects phone-like queries", () => {
    assert.equal(isPhoneLikeQuery("0812"), true);
    assert.equal(isPhoneLikeQuery("+62812"), true);
    assert.equal(isPhoneLikeQuery("budi"), false);
  });

  it("takes the last 4 digits", () => {
    assert.equal(phoneLast4("081234567890"), "7890");
  });
});