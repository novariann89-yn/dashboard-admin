import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTodayWib,
  rupiah,
  startOfTodayWib,
  wibDateString,
} from "./format";

describe("startOfTodayWib", () => {
  it("returns WIB midnight for a given instant", () => {
    const now = new Date(Date.UTC(2026, 0, 15, 3, 30));
    assert.equal(startOfTodayWib(now).getTime(), Date.UTC(2026, 0, 14, 17));
  });

  it("keeps the WIB day when UTC is still the previous day", () => {
    const now = new Date(Date.UTC(2026, 0, 14, 17, 30));
    assert.equal(startOfTodayWib(now).getTime(), Date.UTC(2026, 0, 14, 17));
  });
});

describe("wibDateString", () => {
  it("uses the WIB calendar day, not the UTC day", () => {
    assert.equal(wibDateString(new Date(Date.UTC(2026, 0, 14, 17, 30))), "2026-01-15");
    assert.equal(wibDateString(new Date(Date.UTC(2026, 0, 14, 16, 30))), "2026-01-14");
  });
});

describe("rupiah", () => {
  it("formats with the Indonesian thousands separator", () => {
    assert.equal(rupiah(5000), "Rp 5.000");
    assert.equal(rupiah(1234567), "Rp 1.234.567");
  });
});

describe("isTodayWib", () => {
  it("respects the WIB day boundary", () => {
    const now = new Date(Date.UTC(2026, 0, 15, 6, 0));
    assert.equal(isTodayWib(Date.UTC(2026, 0, 14, 17, 1), now), true);
    assert.equal(isTodayWib(Date.UTC(2026, 0, 14, 16, 59), now), false);
  });
});
