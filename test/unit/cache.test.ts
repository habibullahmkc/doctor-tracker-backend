import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TtlCache } from "../../src/utils/cache";

describe("TtlCache", () => {
  it("serves cached values until they expire", async () => {
    let now = 0;
    const cache = new TtlCache(() => now);
    let loads = 0;
    const load = async () => ++loads;

    assert.equal(await cache.getOrSet("k", 1000, load), 1);
    now = 999;
    assert.equal(await cache.getOrSet("k", 1000, load), 1);
    now = 1001;
    assert.equal(await cache.getOrSet("k", 1000, load), 2);
  });

  it("coalesces concurrent requests into one load", async () => {
    const cache = new TtlCache();
    let loads = 0;
    const load = () => new Promise<number>((resolve) => setTimeout(() => resolve(++loads), 10));
    const results = await Promise.all([1, 2, 3].map(() => cache.getOrSet("k", 1000, load)));
    assert.deepEqual(results, [1, 1, 1]);
    assert.equal(loads, 1);
  });

  it("does not cache failures", async () => {
    const cache = new TtlCache();
    await assert.rejects(cache.getOrSet("k", 1000, () => Promise.reject(new Error("boom"))));
    await new Promise((r) => setImmediate(r));
    assert.equal(await cache.getOrSet("k", 1000, async () => "ok"), "ok");
  });

  it("invalidates by prefix", async () => {
    const cache = new TtlCache();
    await cache.getOrSet("dashboard:7d", 1000, async () => 1);
    await cache.getOrSet("dashboard:30d", 1000, async () => 2);
    await cache.getOrSet("doctors:filters", 1000, async () => 3);
    cache.invalidate("dashboard:");
    assert.equal(cache.size, 1);
  });
});
