import * as assert from "assert";
import { splitOracleScript } from "../../src/sql/sqlSplitter";
import { resolveCurrentOrSelectedSql } from "../../src/sql/sqlTextResolver";

describe("SqlSplitter", () => {
  it("splits ordinary SQL statements by semicolon", () => {
    const statements = splitOracleScript("select 1 from dual; select 2 from dual;");

    assert.deepStrictEqual(
      statements.map((statement) => statement.sql),
      ["select 1 from dual", "select 2 from dual"]
    );
  });

  it("does not split on semicolon inside a string literal", () => {
    const statements = splitOracleScript("select ';' from dual;");

    assert.deepStrictEqual(
      statements.map((statement) => statement.sql),
      ["select ';' from dual"]
    );
  });

  it("does not split on semicolon inside comments", () => {
    const statements = splitOracleScript("select 1 from dual -- ; comment\n; /* ; */ select 2 from dual;");

    assert.deepStrictEqual(
      statements.map((statement) => statement.sql),
      ["select 1 from dual -- ; comment", "/* ; */ select 2 from dual"]
    );
  });

  it("keeps a PL/SQL block together until slash delimiter", () => {
    const statements = splitOracleScript("begin\n  dbms_output.put_line('x');\nend;\n/");

    assert.deepStrictEqual(
      statements.map((statement) => statement.sql),
      ["begin\n  dbms_output.put_line('x');\nend;"]
    );
  });

  it("keeps a package body together until slash delimiter", () => {
    const script = [
      "create or replace package body p as",
      "  procedure run as",
      "  begin",
      "    null;",
      "  end;",
      "end;",
      "/"
    ].join("\n");

    const statements = splitOracleScript(script);

    assert.strictEqual(statements.length, 1);
    assert.ok(statements[0].sql.startsWith("create or replace package body p as"));
    assert.ok(statements[0].sql.endsWith("end;"));
  });

  it("preserves the start line for statements", () => {
    const statements = splitOracleScript("\n\nselect 1 from dual;\nselect 2 from dual;");

    assert.deepStrictEqual(
      statements.map((statement) => statement.startLine),
      [3, 4]
    );
  });
});

describe("SqlTextResolver", () => {
  it("normalizes selected SQL before execution", () => {
    const text = "select 1 from dual;\nselect 2 from dual;";
    const start = text.indexOf("select 2");
    const resolution = resolveCurrentOrSelectedSql(text, start, text.length);

    assert.deepStrictEqual(resolution, {
      sql: "select 2 from dual",
      source: "selection",
      startLine: 2
    });
  });

  it("returns statement around the cursor when there is no selection", () => {
    const text = "select 1 from dual;\nselect 2 from dual;";
    const cursor = text.indexOf("2");
    const resolution = resolveCurrentOrSelectedSql(text, cursor, cursor);

    assert.deepStrictEqual(resolution, {
      sql: "select 2 from dual",
      source: "currentStatement",
      startLine: 2
    });
  });
});
