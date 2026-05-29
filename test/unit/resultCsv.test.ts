import * as assert from "assert";
import { toCsv } from "../../src/results/resultCsv";

describe("Result CSV", () => {
  it("escapes commas, quotes, and newlines", () => {
    assert.strictEqual(
      toCsv(["A", "B"], [["plain", "x,y"], ['a"b', "line1\nline2"]]),
      'A,B\r\nplain,"x,y"\r\n"a""b","line1\nline2"'
    );
  });
});
