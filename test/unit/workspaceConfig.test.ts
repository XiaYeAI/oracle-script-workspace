import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { WorkspaceConfigStore } from "../../src/config/workspaceConfig";
import { makePasswordSecretKey, SecretStorageLike, SecretStore } from "../../src/config/secretStore";

async function createTempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "oracle-workspace-test-"));
}

describe("WorkspaceConfigStore", () => {
  it("returns defaults when workspace config file is missing", async () => {
    const root = await createTempWorkspace();
    const store = new WorkspaceConfigStore(root);

    const config = await store.read();

    assert.deepStrictEqual(config, {
      scriptConnections: {},
      recentSchemas: {},
      favoriteSchemas: {}
    });
  });

  it("binds scripts by basename only", async () => {
    const root = await createTempWorkspace();
    const store = new WorkspaceConfigStore(root);

    await store.setConnectionForScript(path.join(root, "sql", "A.sql"), "DEV_KGDB");

    assert.strictEqual(await store.getConnectionForScript("A.sql"), "DEV_KGDB");
    assert.strictEqual(
      await store.getConnectionForScript(path.join(root, "other", "A.sql")),
      "DEV_KGDB"
    );
  });

  it("does not modify the sql file when updating a binding", async () => {
    const root = await createTempWorkspace();
    const sqlDir = path.join(root, "sql");
    const sqlPath = path.join(sqlDir, "A.sql");
    await fs.mkdir(sqlDir, { recursive: true });
    await fs.writeFile(sqlPath, "select * from dual;\n", "utf8");

    const store = new WorkspaceConfigStore(root);
    await store.setConnectionForScript(sqlPath, "DEV_KGDB");

    assert.strictEqual(await fs.readFile(sqlPath, "utf8"), "select * from dual;\n");
  });

  it("renames script connection bindings", async () => {
    const root = await createTempWorkspace();
    const store = new WorkspaceConfigStore(root);
    await store.write({
      scriptConnections: {
        "A.sql": "DEV_KGDB",
        "B.sql": "UAT_KGDB"
      },
      recentSchemas: {},
      favoriteSchemas: {}
    });

    await store.renameScriptConnection("DEV_KGDB", "DEV_KGDB2");

    assert.strictEqual(await store.getConnectionForScript("A.sql"), "DEV_KGDB2");
    assert.strictEqual(await store.getConnectionForScript("B.sql"), "UAT_KGDB");
  });

  it("stores recent schemas most-recent first and de-duplicates", async () => {
    const root = await createTempWorkspace();
    const store = new WorkspaceConfigStore(root);

    await store.addRecentSchema("DEV_KGDB", "kgdb");
    await store.addRecentSchema("DEV_KGDB", "devsup01");
    await store.addRecentSchema("DEV_KGDB", "KGDB");

    assert.deepStrictEqual(await store.listRecentSchemas("DEV_KGDB"), ["KGDB", "DEVSUP01"]);
  });
});

describe("SecretStore", () => {
  class MemorySecrets implements SecretStorageLike {
    readonly values = new Map<string, string>();

    async get(key: string): Promise<string | undefined> {
      return this.values.get(key);
    }

    async store(key: string, value: string): Promise<void> {
      this.values.set(key, value);
    }

    async delete(key: string): Promise<void> {
      this.values.delete(key);
    }
  }

  it("uses a key that contains only connection name and username", () => {
    const key = makePasswordSecretKey("DEV_KGDB", "kgdb");

    assert.strictEqual(key, "oracleWorkspace.password:DEV_KGDB:kgdb");
    assert.ok(!key.includes("127.0.0.1"));
    assert.ok(!key.includes("orclpdb1"));
    assert.ok(!key.includes("secret-password"));
  });

  it("stores and deletes a password by generated key", async () => {
    const secrets = new MemorySecrets();
    const store = new SecretStore(secrets);

    await store.savePassword("DEV_KGDB", "kgdb", "secret-password");
    assert.strictEqual(await store.getPassword("DEV_KGDB", "kgdb"), "secret-password");

    await store.deletePassword("DEV_KGDB", "kgdb");
    assert.strictEqual(await store.getPassword("DEV_KGDB", "kgdb"), undefined);
  });
});
