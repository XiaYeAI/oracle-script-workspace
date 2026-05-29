import * as assert from "assert";
import { resolveObjectNameAt } from "../../src/objectDetails/objectNameResolver";

describe("ObjectNameResolver", () => {
  it("uses selected object text", () => {
    const text = "select * from customer";
    const start = text.indexOf("customer");

    assert.deepStrictEqual(resolveObjectNameAt(text, start, text.length), {
      objectName: "CUSTOMER"
    });
  });

  it("resolves owner and object name from schema-qualified text", () => {
    const text = "select * from kgdb.customer";
    const cursor = text.indexOf("customer");

    assert.deepStrictEqual(resolveObjectNameAt(text, cursor, cursor), {
      owner: "KGDB",
      objectName: "CUSTOMER"
    });
  });

  it("returns undefined when selected text is not an object token", () => {
    assert.strictEqual(resolveObjectNameAt("select *", 0, 8), undefined);
  });
});
