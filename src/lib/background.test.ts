import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getDb, resetDbInstance } from "./db";
import {
  DEFAULT_BACKGROUND,
  backgroundStyle,
  clampDim,
  clearBackground,
  getBackground,
  setBackground,
} from "./background";

async function clearAll() {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(async () => {
  resetDbInstance();
  await clearAll();
});

describe("clampDim", () => {
  it("clamps to 0..0.7", () => {
    assert.equal(clampDim(-1), 0);
    assert.equal(clampDim(2), 0.7);
    assert.equal(clampDim(0.3), 0.3);
    assert.equal(clampDim(Number.NaN), DEFAULT_BACKGROUND.dim);
  });
});

describe("background storage", () => {
  it("defaults when nothing is stored", async () => {
    const config = await getBackground();
    assert.equal(config.dataUrl, null);
    assert.equal(config.position, DEFAULT_BACKGROUND.position);
    assert.equal(config.dim, DEFAULT_BACKGROUND.dim);
  });

  it("persists and clears", async () => {
    await setBackground("data:image/jpeg;base64,AAAA", "20% 80%", 0.5);
    const config = await getBackground();
    assert.equal(config.dataUrl, "data:image/jpeg;base64,AAAA");
    assert.equal(config.position, "20% 80%");
    assert.equal(config.dim, 0.5);

    await clearBackground();
    assert.equal((await getBackground()).dataUrl, null);
  });

  it("ignores unrelated settings rows", async () => {
    await getDb().settings.put({ key: "storeName", value: "Toko" });
    assert.equal((await getBackground()).dataUrl, null);
  });
});

describe("backgroundStyle", () => {
  it("is empty without an image", () => {
    assert.deepEqual(backgroundStyle(DEFAULT_BACKGROUND), {});
  });

  it("builds a dim layer over a cover image", () => {
    const style = backgroundStyle({
      dataUrl: "data:image/jpeg;base64,AAAA",
      position: "50% 40%",
      dim: 0.2,
    });
    assert.match(style.backgroundImage ?? "", /rgba\(0,0,0,0\.2\)/);
    assert.match(style.backgroundImage ?? "", /url\("data:image\/jpeg;base64,AAAA"\)/);
    assert.equal(style.backgroundSize, "cover");
    assert.equal(style.backgroundPosition, "50% 40%");
    assert.equal(style.backgroundAttachment, "fixed");
  });
});
