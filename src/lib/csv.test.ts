import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves plain values untouched", () => {
    assert.equal(csvCell("halo"), "halo");
    assert.equal(csvCell(1234), "1234");
  });

  it("maps null/undefined to an empty string", () => {
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
  });

  it("quotes and escapes when needed", () => {
    assert.equal(csvCell("a;b"), '"a;b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  });
});

describe("toCsv", () => {
  it("joins rows with the delimiter and CRLF", () => {
    const rows = [
      ["nama", "qty"],
      ["Sari Kedelai", 2],
    ];
    assert.equal(toCsv(rows), "nama;qty\r\nSari Kedelai;2");
  });
});
