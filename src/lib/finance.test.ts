import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePeriod } from "./finance";
import { startOfTodayWib } from "./format";

const DAY = 86400000;
const WIB = 7 * 60 * 60 * 1000;
const now = new Date("2026-09-15T10:00:00+07:00");
const today = startOfTodayWib(now).getTime();

describe("resolvePeriod", () => {
  it("today", () => {
    const p = resolvePeriod({ preset: "today" }, now);
    assert.equal(p.from, today);
    assert.equal(p.to, today + DAY);
    assert.equal(p.label, "Hari ini");
  });

  it("yesterday", () => {
    const p = resolvePeriod({ preset: "yesterday" }, now);
    assert.equal(p.from, today - DAY);
    assert.equal(p.to, today);
    assert.equal(p.label, "Kemarin");
  });

  it("week covers 7 days including today", () => {
    const p = resolvePeriod({ preset: "week" }, now);
    assert.equal(p.from, today - 6 * DAY);
    assert.equal(p.to, today + DAY);
  });

  it("month is the current calendar month (WIB)", () => {
    const p = resolvePeriod({ preset: "month" }, now);
    assert.equal(p.from, Date.UTC(2026, 8, 1) - WIB);
    assert.equal(p.to, Date.UTC(2026, 9, 1) - WIB);
  });

  it("day", () => {
    const p = resolvePeriod({ preset: "day", day: "2026-09-01" }, now);
    assert.equal(p.from, Date.UTC(2026, 8, 1) - WIB);
    assert.equal(p.to, Date.UTC(2026, 8, 1) - WIB + DAY);
    assert.equal(p.label, "2026-09-01");
  });

  it("range includes the end day", () => {
    const p = resolvePeriod(
      { preset: "range", from: "2026-09-01", to: "2026-09-03" },
      now,
    );
    assert.equal(p.from, Date.UTC(2026, 8, 1) - WIB);
    assert.equal(p.to, Date.UTC(2026, 8, 3) - WIB + DAY);
    assert.equal(p.label, "1 Sep – 3 Sep");
  });

  it("range swaps reversed bounds", () => {
    const reversed = resolvePeriod(
      { preset: "range", from: "2026-09-03", to: "2026-09-01" },
      now,
    );
    const normal = resolvePeriod(
      { preset: "range", from: "2026-09-01", to: "2026-09-03" },
      now,
    );
    assert.equal(reversed.from, normal.from);
    assert.equal(reversed.to, normal.to);
  });

  it("range falls back to today when a bound is missing", () => {
    const p = resolvePeriod({ preset: "range" }, now);
    assert.equal(p.from, today);
    assert.equal(p.to, today + DAY);
  });

  it("range on a single day uses a one-date label", () => {
    const p = resolvePeriod(
      { preset: "range", from: "2026-09-05", to: "2026-09-05" },
      now,
    );
    assert.equal(p.to - p.from, DAY);
    assert.equal(p.label, "5 Sep");
  });
});
