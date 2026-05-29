import * as assert from "assert";
import * as fs from "fs/promises";
import * as path from "path";
import { parseTnsnames } from "../../src/connections/tnsnamesParser";

describe("TnsnamesParser", () => {
  it("parses aliases from a tnsnames.ora file", async () => {
    const sourcePath = path.join(process.cwd(), "test", "fixtures", "sample-tnsnames.ora");
    const content = await fs.readFile(sourcePath, "utf8");

    const result = parseTnsnames(content, sourcePath);

    assert.deepStrictEqual(
      result.aliases.map((alias) => alias.alias),
      ["KGDB_UAT", "HISDB"]
    );
    assert.strictEqual(result.errors.length, 0);
    assert.ok(result.aliases[0].rawDescription.includes("SERVICE_NAME = kgdbuat"));
  });

  it("keeps valid aliases when another alias is malformed", () => {
    const result = parseTnsnames(
      [
        "BAD_ALIAS =",
        "  (DESCRIPTION =",
        "    (ADDRESS = (PROTOCOL = TCP)(HOST = bad-host)(PORT = 1521))",
        "GOOD_ALIAS =",
        "  (DESCRIPTION =",
        "    (ADDRESS = (PROTOCOL = TCP)(HOST = good-host)(PORT = 1521))",
        "    (CONNECT_DATA = (SERVICE_NAME = good))",
        "  )"
      ].join("\n"),
      "memory/tnsnames.ora"
    );

    assert.deepStrictEqual(
      result.aliases.map((alias) => alias.alias),
      ["GOOD_ALIAS"]
    );
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0].sourcePath, "memory/tnsnames.ora");
    assert.ok(result.errors[0].message.includes("BAD_ALIAS"));
  });

  it("ignores blank lines and comments", () => {
    const result = parseTnsnames(
      [
        "# a comment",
        "",
        "DEV = # inline comment",
        "  (DESCRIPTION =",
        "    (ADDRESS = (PROTOCOL = TCP)(HOST = dev-host)(PORT = 1521))",
        "    (CONNECT_DATA = (SERVICE_NAME = dev))",
        "  )"
      ].join("\n"),
      "memory/tnsnames.ora"
    );

    assert.deepStrictEqual(
      result.aliases.map((alias) => alias.alias),
      ["DEV"]
    );
    assert.strictEqual(result.errors.length, 0);
  });
});
