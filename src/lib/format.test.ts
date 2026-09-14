import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { csvDate, csvDateTime, parseWibDateTimeLocal } from "./format";

describe("parseWibDateTimeLocal", () => {
  it("interprets datetime-local as Asia/Jakarta time", () => {
    const date = parseWibDateTimeLocal("2026-09-14T14:30");
    assert.equal(date?.toISOString(), "2026-09-14T07:30:00.000Z");
  });

  it("treats midnight WIB correctly", () => {
    const date = parseWibDateTimeLocal("2026-01-02T00:00");
    assert.equal(date?.toISOString(), "2026-01-01T17:00:00.000Z");
  });

  it("rejects malformed input", () => {
    assert.equal(parseWibDateTimeLocal(""), null);
    assert.equal(parseWibDateTimeLocal("abc"), null);
    assert.equal(parseWibDateTimeLocal("2026-09-14"), null);
  });

  it("rejects out-of-range values", () => {
    assert.equal(parseWibDateTimeLocal("2026-13-01T10:00"), null);
    assert.equal(parseWibDateTimeLocal("2026-02-30T10:00"), null);
    assert.equal(parseWibDateTimeLocal("2026-09-14T25:00"), null);
    assert.equal(parseWibDateTimeLocal("2026-09-14T10:75"), null);
  });
});

describe("csv date helpers", () => {
  it("formats a date in WIB", () => {
    const date = new Date("2026-09-14T07:30:00.000Z");
    assert.equal(csvDate(date), "2026-09-14");
    assert.equal(csvDateTime(date), "2026-09-14 14:30");
  });

  it("returns empty string for missing dates", () => {
    assert.equal(csvDate(null), "");
    assert.equal(csvDateTime(undefined), "");
  });
});
