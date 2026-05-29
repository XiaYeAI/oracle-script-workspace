import * as assert from "assert";
import { createExecutionBatch } from "../../src/results/resultModel";
import { renderResultPanelHtml } from "../../src/results/resultPanelHtml";

describe("ResultModel", () => {
  it("creates one query item for a single query result", () => {
    const batch = createExecutionBatch("DEV_KGDB", [
      {
        type: "query",
        columns: ["ID", "NAME"],
        rows: [[1, "Alice"]],
        hasMoreRows: false,
        elapsedMs: 12
      }
    ]);

    assert.strictEqual(batch.connectionName, "DEV_KGDB");
    assert.strictEqual(batch.items.length, 1);
    assert.deepStrictEqual(batch.items[0], {
      kind: "query",
      title: "Query Result",
      columns: ["ID", "NAME"],
      rows: [[1, "Alice"]],
      hasMoreRows: false,
      elapsedMs: 12
    });
  });

  it("keeps all items from a multi-statement execution batch", () => {
    const batch = createExecutionBatch("DEV_KGDB", [
      { type: "query", columns: ["A"], rows: [[1]], hasMoreRows: false, elapsedMs: 1 },
      { type: "query", columns: ["B"], rows: [[2]], hasMoreRows: false, elapsedMs: 2 },
      { type: "update", rowsAffected: 3, elapsedMs: 3 },
      { type: "query", columns: ["C"], rows: [[4]], hasMoreRows: false, elapsedMs: 4 }
    ], ["select 1 from dual", "select 2 from dual", "update t set a = 1", "select 4 from dual"]);

    assert.deepStrictEqual(
      batch.items.map((item) => item.title),
      ["Query Result", "Query Result", "Update Count", "Query Result"]
    );
    assert.strictEqual(batch.items.length, 4);
  });

  it("classifies DCL and DDL statements as success messages instead of update counts", () => {
    const batch = createExecutionBatch("DEV_KGDB", [
      { type: "update", rowsAffected: 0, elapsedMs: 1 },
      { type: "update", rowsAffected: 0, elapsedMs: 2 },
      { type: "update", rowsAffected: 0, elapsedMs: 3 }
    ], [
      "grant select on accounts to devsup01",
      "create index idx_accounts_1 on accounts(account)",
      "truncate table stage_accounts"
    ]);

    assert.deepStrictEqual(batch.items.map((item) => item.kind), ["message", "message", "message"]);
    assert.deepStrictEqual(batch.items.map((item) => item.title), ["Grant", "Create", "Truncate"]);
    assert.deepStrictEqual(
      batch.items.map((item) => item.kind === "message" ? item.message : ""),
      ["Grant succeeded.", "Create succeeded.", "Truncate succeeded."]
    );
  });

  it("labels commit and rollback execution results as success messages", () => {
    const batch = createExecutionBatch("DEV_KGDB", [
      { type: "update", rowsAffected: 0, elapsedMs: 1 },
      { type: "update", rowsAffected: 0, elapsedMs: 1 }
    ], ["commit", "rollback"]);

    assert.deepStrictEqual(batch.items.map((item) => item.kind), ["message", "message"]);
    assert.deepStrictEqual(batch.items.map((item) => item.title), ["Commit", "Rollback"]);
  });

  it("creates a fresh batch id for each execution", () => {
    const first = createExecutionBatch("DEV_KGDB", []);
    const second = createExecutionBatch("DEV_KGDB", []);

    assert.notStrictEqual(first.id, second.id);
  });

  it("escapes HTML in rendered results", () => {
    const batch = createExecutionBatch("DEV_KGDB", [
      {
        type: "query",
        columns: ["NAME"],
        rows: [["<script>alert(1)</script>"]],
        hasMoreRows: false,
        elapsedMs: 1
      }
    ]);

    const html = renderResultPanelHtml(batch);

    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  });
});
