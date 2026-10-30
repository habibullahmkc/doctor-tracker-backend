import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAY_MS,
  dateParam,
  dateRangeFilter,
  startOfDhakaDay,
  startOfDhakaMonth,
  toDhakaYMD,
} from "../../src/utils/dates";
import { buildPaginationMeta, paginationSchema, toSkip } from "../../src/utils/pagination";

describe("pagination", () => {
  it("applies defaults and coerces query strings", () => {
    assert.deepEqual(paginationSchema.parse({}), { page: 1, limit: 10 });
    assert.deepEqual(paginationSchema.parse({ page: "3", limit: "25" }), { page: 3, limit: 25 });
  });

  it("rejects out-of-range values", () => {
    assert.equal(paginationSchema.safeParse({ page: 0 }).success, false);
    assert.equal(paginationSchema.safeParse({ limit: 101 }).success, false);
  });

  it("computes skip and meta", () => {
    assert.equal(toSkip(3, 10), 20);
    assert.deepEqual(buildPaginationMeta(2, 10, 45), { page: 2, limit: 10, total: 45, totalPages: 5 });
    assert.equal(buildPaginationMeta(1, 10, 0).totalPages, 1, "an empty list still has one page");
  });
});

describe("dates (Asia/Dhaka)", () => {
  it("parses YYYY-MM-DD as Dhaka midnight", () => {
    assert.equal(startOfDhakaDay("2026-10-30").toISOString(), "2026-10-29T18:00:00.000Z");
    assert.equal(dateParam.parse("2026-10-30").toISOString(), "2026-10-29T18:00:00.000Z");
    assert.equal(dateParam.safeParse("30/10/2026").success, false);
  });

  it("formats instants in Dhaka time", () => {
    assert.equal(toDhakaYMD(new Date("2026-10-30T19:00:00Z")), "2026-10-31");
  });

  it("makes the 'to' date inclusive of the whole day", () => {
    const from = startOfDhakaDay("2026-10-01");
    const to = startOfDhakaDay("2026-10-30");
    const range = dateRangeFilter(from, to);
    assert.equal(range?.$gte, from);
    assert.equal(range?.$lt?.getTime(), to.getTime() + DAY_MS);
    assert.equal(dateRangeFilter(), undefined);
  });

  it("finds the start of earlier months across a year boundary", () => {
    const now = new Date("2026-02-15T06:00:00Z");
    assert.equal(startOfDhakaMonth(0, now).key, "2026-02");
    assert.equal(startOfDhakaMonth(3, now).key, "2025-11");
  });
});
