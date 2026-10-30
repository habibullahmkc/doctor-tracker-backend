import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSearchFilter, escapeRegex, toTokens } from "../../src/utils/searchTokens";

describe("toTokens", () => {
  it("lower-cases, splits on separators and de-duplicates", () => {
    assert.deepEqual(toTokens("Dr. Sarah Ahmed", "Square Hospital", "sarah.ahmed@gmail.com"), [
      "dr",
      "sarah",
      "ahmed",
      "square",
      "hospital",
      "gmail",
      "com",
    ]);
  });

  it("ignores empty parts", () => {
    assert.deepEqual(toTokens("Rahim", undefined, null, ""), ["rahim"]);
  });
});

describe("escapeRegex", () => {
  it("escapes every regex metacharacter", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal regex metacharacters under test
    const input = ".*+?^${}()|[]\\";
    assert.equal(new RegExp(`^${escapeRegex(input)}$`).test(input), true);
  });
});

describe("buildSearchFilter", () => {
  it("returns an empty filter for blank input", () => {
    assert.deepEqual(buildSearchFilter(), {});
    assert.deepEqual(buildSearchFilter("   "), {});
  });

  it("builds anchored, escaped prefix regexes that must all match", () => {
    const filter = buildSearchFilter("Sarah  car(") as { searchTokens: { $all: RegExp[] } };
    const [first, second] = filter.searchTokens.$all;
    assert.equal(first.source, "^sarah");
    assert.equal(second.source, "^car\\(");
    assert.equal(first.test("sarah"), true);
    assert.equal(first.test("xsarah"), false, "must be anchored so the index can be used");
  });

  it("caps the number of terms", () => {
    const filter = buildSearchFilter("a b c d e f g") as { searchTokens: { $all: RegExp[] } };
    assert.equal(filter.searchTokens.$all.length, 5);
  });
});
