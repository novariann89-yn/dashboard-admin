import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fuzzyScore,
  levenshtein,
  normalizeName,
  normalizePhone,
  searchCustomers,
  trigramSimilarity,
} from "./search";
import type { Customer } from "./types";

function customer(partial: Partial<Customer>): Customer {
  return {
    id: partial.id ?? partial.name ?? "id",
    name: partial.name ?? "Tanpa Nama",
    nameNormal: normalizeName(partial.name ?? "Tanpa Nama"),
    phoneNormal: partial.phoneNormal ?? normalizePhone(partial.phoneNormal ?? "081200000000") ?? "081200000000",
    active: true,
    ...partial,
  };
}

describe("levenshtein", () => {
  it("computes edit distance", () => {
    assert.equal(levenshtein("bdi", "budi"), 1);
    assert.equal(levenshtein("sinta", "shinta"), 1);
    assert.equal(levenshtein("budi", "budi"), 0);
    assert.equal(levenshtein("", "abc"), 3);
  });
});

describe("trigramSimilarity", () => {
  it("returns 1 for identical strings", () => {
    assert.equal(trigramSimilarity("budi", "budi"), 1);
  });

  it("returns a partial score for similar strings", () => {
    const similarity = trigramSimilarity("budi", "budy");
    assert.ok(similarity >= 0.4);
  });

  it("returns 0 for unrelated short strings", () => {
    assert.equal(trigramSimilarity("ab", "cd"), 0);
  });
});

describe("fuzzyScore", () => {
  it("scores typos within distance 2", () => {
    assert.ok(fuzzyScore("bdi", "budi") >= 40);
    assert.ok(fuzzyScore("sinta", "shinta") >= 40);
  });

  it("ignores very short queries and unrelated names", () => {
    assert.equal(fuzzyScore("bd", "budi"), 0);
    assert.equal(fuzzyScore("xyz", "budi"), 0);
  });
});

describe("fuzzy search", () => {
  const customers = [
    customer({ id: "1", name: "Budi Santoso", phoneNormal: "081234567890" }),
    customer({ id: "2", name: "Shinta Dewi", phoneNormal: "081298765432" }),
    customer({ id: "3", name: "Siti Aminah", phoneNormal: "081277778888" }),
  ];

  it("finds a name despite a typo", () => {
    const results = searchCustomers("bdi", customers);
    assert.equal(results[0]?.customer.id, "1");
  });

  it("finds shinta from sinta", () => {
    const results = searchCustomers("sinta", customers);
    assert.equal(results[0]?.customer.id, "2");
  });

  it("still prefers exact and prefix matches over fuzzy", () => {
    const results = searchCustomers("siti", customers);
    assert.equal(results[0]?.customer.id, "3");
  });
});