import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("keeps canonical 08 format", () => {
    assert.equal(normalizePhone("081234567890"), "081234567890");
  });

  it("converts +62 format", () => {
    assert.equal(normalizePhone("+6281234567890"), "081234567890");
  });

  it("converts 62 format", () => {
    assert.equal(normalizePhone("6281234567890"), "081234567890");
  });

  it("converts 8-prefixed format", () => {
    assert.equal(normalizePhone("81234567890"), "081234567890");
  });

  it("strips spaces and dashes", () => {
    assert.equal(normalizePhone("0812-3456-7890"), "081234567890");
    assert.equal(normalizePhone("0812 3456 7890"), "081234567890");
  });

  it("rejects empty and non-numeric input", () => {
    assert.equal(normalizePhone(""), null);
    assert.equal(normalizePhone("abc"), null);
  });

  it("rejects invalid lengths and prefixes", () => {
    assert.equal(normalizePhone("0812345"), null);
    assert.equal(normalizePhone("0211234567"), null);
  });
});

describe("formatPhone", () => {
  it("groups digits for display", () => {
    assert.equal(formatPhone("081234567890"), "0812-3456-7890");
  });
});