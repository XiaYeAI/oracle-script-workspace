import * as assert from "assert";
import { createScriptBindingNodes } from "../../src/workbench/scriptBindingModel";

describe("ScriptBindingProvider", () => {
  it("shows a prompt when no SQL file is active", () => {
    assert.deepStrictEqual(createScriptBindingNodes(undefined, undefined, false), [
      { kind: "message", label: "Open a .sql file to see its workspace." }
    ]);
  });

  it("shows current file, binding, transaction, and actions", () => {
    const nodes = createScriptBindingNodes("E:/work/查客户信息.sql", "DEV_KGDB", true);

    assert.deepStrictEqual(nodes.slice(0, 3), [
      { kind: "field", label: "File", description: "查客户信息.sql", icon: "file-code" },
      { kind: "field", label: "Connection", description: "DEV_KGDB", icon: "database" },
      { kind: "field", label: "Transaction", description: "uncommitted", icon: "warning" }
    ]);
    assert.deepStrictEqual(
      nodes.slice(3).map((node) => node.label),
      ["Switch Connection", "Run Current", "Run Script", "Commit", "Rollback"]
    );
  });
});
