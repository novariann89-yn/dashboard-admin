import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startOfTodayWib, rupiah, formatDateTime, isTodayWib } from "./format";

describe("rupiah", () => {
  it("formats with thousand separators", () => {
    assert.equal(rupiah(15000), "Rp 15.000");
    assert.equal(rupiah(0), "Rp 0");
  });
});

describe("WIB helpers", () => {
  it("starts the day at midnight WIB (17:00 UTC previous day)", () => {
    const start = startOfTodayWib(new Date("2026-09-14T07:30:00.000Z"));
    assert.equal(start.toISOString(), "2026-09-13T17:00:00.000Z");
  });

  it("detects today in WIB", () => {
    const now = new Date("2026-09-14T07:30:00.000Z");
    assert.equal(isTodayWib(new Date("2026-09-14T07:00:00.000Z"), now), true);
    assert.equal(isTodayWib(new Date("2026-09-13T16:59:00.000Z"), now), false);
  });

  it("formats date-time in Jakarta time", () => {
    const formatted = formatDateTime(new Date("2026-09-14T07:30:00.000Z"));
    assert.match(formatted, /14/);
    assert.match(formatted, /14\.30|14:30/);
  });
});