import * as assert from "assert";
import { renderResultPanelHtml } from "../../src/results/resultPanelHtml";

describe("ResultPanelHtml", () => {
  it("renders tabs and copy cell row actions", () => {
    const html = renderResultPanelHtml({
      id: "1",
      connectionName: "DEV_KGDB",
      startedAt: "2026-05-26T00:00:00.000Z",
      items: [
        { kind: "query", title: "Result 1", columns: ["A"], rows: [[1]], hasMoreRows: true, elapsedMs: 1 },
        { kind: "update", title: "Update Count", rowsAffected: 2, elapsedMs: 1 },
        { kind: "message", title: "Commit", message: "Commit succeeded.", elapsedMs: 1 }
      ]
    });

    assert.ok(html.includes('class="tabs"'));
    assert.ok(html.includes("Copy Cell"));
    assert.ok(html.includes("Copy Row"));
    assert.ok(html.includes("Fetch Next"));
    assert.ok(html.includes("Update Count"));
    assert.ok(html.includes("Commit succeeded."));
  });

  it("renders non-query statements together without per-statement tabs", () => {
    const html = renderResultPanelHtml({
      id: "1",
      connectionName: "DEV_KGDB",
      startedAt: "2026-05-26T00:00:00.000Z",
      items: [
        { kind: "update", title: "Update Count", rowsAffected: 2, elapsedMs: 1 },
        { kind: "message", title: "Grant", message: "Grant succeeded.", elapsedMs: 2 },
        { kind: "message", title: "Commit", message: "Commit succeeded.", elapsedMs: 3 }
      ]
    });

    assert.ok(!html.includes('class="tabs"'));
    assert.ok(html.includes("Execution Results"));
    assert.ok(html.includes("Update Count"));
    assert.ok(html.includes("Grant succeeded."));
    assert.ok(html.includes("Commit succeeded."));
  });
});
