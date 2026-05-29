import * as assert from "assert";
import { OracleObjectDetailsService } from "../../src/objectDetails/objectDetailsService";
import { renderObjectDetailsHtml } from "../../src/objectDetails/objectDetailsHtml";

describe("ObjectDetailsHtml", () => {
  it("renders object details as tabs with copy/open actions", () => {
    const html = renderObjectDetailsHtml(
      { connectionName: "DEV_KGDB", owner: "KGDB", objectName: "CUSTOMER", objectType: "TABLE" },
      [
        { title: "Columns", kind: "table", content: [{ COLUMN_NAME: "ID" }] },
        { title: "DDL", kind: "code", content: "create table customer (id number)" }
      ]
    );

    assert.ok(html.includes('class="tabs"'));
    assert.ok(html.includes('data-action="copy"'));
    assert.ok(html.includes('data-action="openAsSql"'));
    assert.ok(html.includes("KGDB.CUSTOMER"));
  });
});

describe("OracleObjectDetailsService", () => {
  it("converts DDL LOB values to text instead of rendering object placeholders", async () => {
    const service = new OracleObjectDetailsService(
      {
        async execute(_connectionName, sql) {
          if (sql.includes("dbms_metadata.get_ddl")) {
            return {
              type: "query",
              columns: ["DDL"],
              rows: [[{ getData: async () => "CREATE TABLE KGDB.ACCOUNTS (ID NUMBER)" }]],
              hasMoreRows: false,
              elapsedMs: 1
            };
          }

          return { type: "query", columns: [], rows: [], hasMoreRows: false, elapsedMs: 1 };
        }
      },
      {
        async ensurePassword() {
          return undefined;
        }
      }
    );

    const tabs = await service.getDetails({
      connectionName: "DEV_KGDB",
      owner: "KGDB",
      objectName: "ACCOUNTS",
      objectType: "TABLE"
    });
    const ddl = tabs.find((tab) => tab.title === "DDL");

    assert.strictEqual(ddl?.content, "CREATE TABLE KGDB.ACCOUNTS (ID NUMBER)");
  });
});
