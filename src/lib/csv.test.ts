import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("returns plain text unchanged", () => {
    assert.equal(csvCell("Budi", ";"), "Budi");
  });

  it("quotes cells containing the delimiter", () => {
    assert.equal(csvCell("a;b", ";"), '"a;b"');
  });

  it("escapes quotes", () => {
    assert.equal(csvCell('He said "hi"', ";"), '"He said ""hi"""');
  });

  it("quotes multiline cells", () => {
    assert.equal(csvCell("baris satu\nbaris dua", ";"), '"baris satu\nbaris dua"');
  });

  it("handles null, undefined, numbers and booleans", () => {
    assert.equal(csvCell(null, ";"), "");
    assert.equal(csvCell(undefined, ";"), "");
    assert.equal(csvCell(15000, ";"), "15000");
    assert.equal(csvCell(true, ";"), "true");
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and cells with the delimiter", () => {
    assert.equal(toCsv([["a", "b"], ["c", "d"]]), "a;b\r\nc;d");
  });
});