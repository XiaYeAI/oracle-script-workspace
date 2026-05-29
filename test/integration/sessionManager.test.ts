import * as assert from "assert";
import { OracleConnectionConfig } from "../../src/config/connectionConfig";
import {
  OracleAdapter,
  OracleConnectionHandle,
  OracleExecutionResult,
  OracleExecuteOptions
} from "../../src/connections/oracleAdapter";
import { OracleSessionManager } from "../../src/connections/oracleSessionManager";
import { formatOracleError } from "../../src/ui/errors";

class MockHandle implements OracleConnectionHandle {
  readonly calls: string[] = [];

  constructor(private readonly result: OracleExecutionResult) {}

  async execute(sql: string, _options: OracleExecuteOptions): Promise<OracleExecutionResult> {
    this.calls.push(`execute:${sql}`);
    return this.result;
  }

  async commit(): Promise<void> {
    this.calls.push("commit");
  }

  async rollback(): Promise<void> {
    this.calls.push("rollback");
  }

  async close(): Promise<void> {
    this.calls.push("close");
  }
}

class MockAdapter implements OracleAdapter {
  readonly handles: MockHandle[] = [];

  constructor(private readonly result: OracleExecutionResult) {}

  async connect(_config: OracleConnectionConfig, _password: string): Promise<OracleConnectionHandle> {
    const handle = new MockHandle(this.result);
    this.handles.push(handle);
    return handle;
  }
}

const connection: OracleConnectionConfig = {
  name: "DEV_KGDB",
  type: "custom",
  host: "127.0.0.1",
  port: 1521,
  serviceName: "orclpdb1",
  username: "kgdb"
};

function createManager(result: OracleExecutionResult): {
  adapter: MockAdapter;
  manager: OracleSessionManager;
} {
  const adapter = new MockAdapter(result);
  const manager = new OracleSessionManager(
    adapter,
    {
      async getConnection(connectionName: string) {
        return connectionName === "DEV_KGDB" ? connection : undefined;
      }
    },
    {
      async getPassword() {
        return "secret-password";
      }
    },
    500
  );

  return { adapter, manager };
}

describe("OracleSessionManager", () => {
  it("shares one session for the same connection name", async () => {
    const { adapter, manager } = createManager({
      type: "query",
      columns: ["DUMMY"],
      rows: [["X"]],
      hasMoreRows: false,
      elapsedMs: 1
    });

    await manager.execute("DEV_KGDB", "select 1 from dual");
    await manager.execute("DEV_KGDB", "select 2 from dual");

    assert.strictEqual(adapter.handles.length, 1);
    assert.deepStrictEqual(adapter.handles[0].calls, [
      "execute:select 1 from dual",
      "execute:select 2 from dual"
    ]);
  });

  it("marks update results as uncommitted", async () => {
    const { manager } = createManager({ type: "update", rowsAffected: 1, elapsedMs: 1 });

    await manager.execute("DEV_KGDB", "update customer set name = 'x'");

    assert.strictEqual(manager.hasUncommittedChanges("DEV_KGDB"), true);
  });

  it("commit clears dirty state", async () => {
    const { adapter, manager } = createManager({ type: "update", rowsAffected: 1, elapsedMs: 1 });

    await manager.execute("DEV_KGDB", "update customer set name = 'x'");
    await manager.commit("DEV_KGDB");

    assert.strictEqual(manager.hasUncommittedChanges("DEV_KGDB"), false);
    assert.ok(adapter.handles[0].calls.includes("commit"));
  });

  it("rollback clears dirty state", async () => {
    const { adapter, manager } = createManager({ type: "update", rowsAffected: 1, elapsedMs: 1 });

    await manager.execute("DEV_KGDB", "update customer set name = 'x'");
    await manager.rollback("DEV_KGDB");

    assert.strictEqual(manager.hasUncommittedChanges("DEV_KGDB"), false);
    assert.ok(adapter.handles[0].calls.includes("rollback"));
  });

  it("formats errors without leaking passwords", () => {
    const error = new Error("ORA-01017: invalid credentials password=secret-password");

    const formatted = formatOracleError(error);

    assert.strictEqual(formatted.code, "ORA-01017");
    assert.ok(formatted.message.includes("ORA-01017"));
    assert.ok(!formatted.safeDetails.includes("secret-password"));
  });
});
