import * as assert from "assert";
import { renderCurrentScriptHtml } from "../../src/workbench/currentScriptHtml";

describe("CurrentScriptHtml", () => {
  it("renders bind and add actions when a SQL file has no connection", () => {
    const html = renderCurrentScriptHtml({
      fileName: "E:/work/查客户信息.sql",
      hasUncommittedChanges: false,
      maxRows: 500
    });

    assert.ok(html.includes("查客户信息.sql"));
    assert.ok(html.includes("Bind Connection"));
    assert.ok(html.includes("Add Connection"));
  });

  it("renders uncommitted state for dirty sessions", () => {
    const html = renderCurrentScriptHtml({
      fileName: "A.sql",
      connectionName: "DEV_KGDB",
      connection: {
        name: "DEV_KGDB",
        type: "custom",
        host: "127.0.0.1",
        port: 1521,
        serviceName: "orclpdb1",
        username: "KGDB"
      },
      hasUncommittedChanges: true,
      maxRows: 500
    });

    assert.ok(html.includes("uncommitted"));
    assert.ok(html.includes("Explain Plan"));
  });
});
