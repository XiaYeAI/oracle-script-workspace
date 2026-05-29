import * as assert from "assert";
import { createRootConnectionNodes } from "../../src/tree/connectionTreeModel";

describe("ConnectionTreeModel", () => {
  it("shows an empty-state message when no connections are configured", async () => {
    const children = createRootConnectionNodes([]);

    assert.strictEqual(children.length, 1);
    assert.deepStrictEqual(children[0], {
      kind: "message",
      message: "No connections configured. Use + to add one."
    });
  });
});
