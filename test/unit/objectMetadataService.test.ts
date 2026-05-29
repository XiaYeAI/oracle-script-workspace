import * as assert from "assert";
import { OracleObjectMetadataService } from "../../src/tree/objectMetadataService";

describe("OracleObjectMetadataService", () => {
  it("uses Oracle 11g-compatible row limiting when listing objects", async () => {
    const executed: string[] = [];
    const service = new OracleObjectMetadataService(
      {
        async execute(_connectionName: string, sql: string) {
          executed.push(sql);
          return { type: "query", rows: [] };
        }
      },
      {
        async ensurePassword() {
          return undefined;
        }
      }
    );

    await service.listObjects("DEV_KGDB", "KGDBFISL", "VIEW");

    assert.strictEqual(executed.length, 1);
    assert.ok(!executed[0].toLowerCase().includes("fetch first"));
    assert.ok(executed[0].toLowerCase().includes("where rownum <= 200"));
  });
});
