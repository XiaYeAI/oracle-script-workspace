import * as assert from "assert";
import { OracleConnectionConfig } from "../../src/config/connectionConfig";
import {
  OracleCommandWorkflow,
  OracleWorkflowDocument,
  OracleWorkflowResultPanel,
  OracleWorkflowStatusBar,
  OracleWorkflowWindow
} from "../../src/commands/oracleCommandWorkflow";
import { OracleExecutionResult } from "../../src/connections/oracleAdapter";
import { ExecutionBatch } from "../../src/results/resultModel";

const connection: OracleConnectionConfig = {
  name: "DEV_KGDB",
  type: "custom",
  host: "127.0.0.1",
  port: 1521,
  serviceName: "orclpdb1",
  username: "kgdb"
};

class FakeWorkspaceConfig {
  readonly bindings = new Map<string, string>();

  async getConnectionForScript(fileName: string): Promise<string | undefined> {
    return this.bindings.get(fileName.split(/[\\/]/).pop() ?? fileName);
  }

  async setConnectionForScript(fileName: string, connectionName: string): Promise<void> {
    this.bindings.set(fileName.split(/[\\/]/).pop() ?? fileName, connectionName);
  }
}

class FakeConnectionStore {
  readonly connections = [connection];

  listConfiguredConnections(): OracleConnectionConfig[] {
    return this.connections;
  }

  getConnection(connectionName: string): OracleConnectionConfig | undefined {
    return this.connections.find((item) => item.name === connectionName);
  }
}

class FakeSecrets {
  readonly saved: Array<{ connectionName: string; username: string; password: string }> = [];
  password: string | undefined;

  async getPassword(): Promise<string | undefined> {
    return this.password;
  }

  async savePassword(connectionName: string, username: string, password: string): Promise<void> {
    this.password = password;
    this.saved.push({ connectionName, username, password });
  }
}

class FakeSessionManager {
  readonly executed: string[] = [];
  readonly committed: string[] = [];
  readonly rolledBack: string[] = [];
  dirty = false;
  failOnSql: RegExp | undefined;

  async execute(_connectionName: string, sql: string): Promise<OracleExecutionResult> {
    this.executed.push(sql);
    if (this.failOnSql?.test(sql)) {
      throw new Error("ORA-00942: table or view does not exist");
    }
    if (/^\s*update\b/i.test(sql)) {
      this.dirty = true;
      return { type: "update", rowsAffected: 1, elapsedMs: 3 };
    }
    return { type: "query", columns: ["DUMMY"], rows: [["X"]], hasMoreRows: false, elapsedMs: 2 };
  }

  async commit(connectionName: string): Promise<void> {
    this.committed.push(connectionName);
    this.dirty = false;
  }

  async rollback(connectionName: string): Promise<void> {
    this.rolledBack.push(connectionName);
    this.dirty = false;
  }

  hasUncommittedChanges(): boolean {
    return this.dirty;
  }
}

class FakeWindow implements OracleWorkflowWindow {
  pickedConnection = "DEV_KGDB";
  password = "secret-password";
  confirm = true;
  confirmations: number[] = [];
  infos: string[] = [];

  async pickConnection(connectionNames: string[]): Promise<string | undefined> {
    assert.ok(connectionNames.includes(this.pickedConnection));
    return this.pickedConnection;
  }

  async inputPassword(_connectionName: string, _username: string): Promise<string | undefined> {
    return this.password;
  }

  async showInformationMessage(message: string): Promise<void> {
    this.infos.push(message);
  }

  async confirmRunScript(statementCount: number): Promise<boolean> {
    this.confirmations.push(statementCount);
    return this.confirm;
  }

  async showErrorMessage(message: string): Promise<void> {
    throw new Error(message);
  }
}

class FakeResultPanel implements OracleWorkflowResultPanel {
  batches: ExecutionBatch[] = [];

  show(batch: ExecutionBatch): void {
    this.batches.push(batch);
  }
}

class FakeStatusBar implements OracleWorkflowStatusBar {
  states: Array<{ connectionName?: string; hasUncommittedChanges: boolean }> = [];

  update(state: { connectionName?: string; hasUncommittedChanges: boolean }): void {
    this.states.push(state);
  }
}

function createWorkflow(): {
  workflow: OracleCommandWorkflow;
  workspaceConfig: FakeWorkspaceConfig;
  secrets: FakeSecrets;
  session: FakeSessionManager;
  resultPanel: FakeResultPanel;
  statusBar: FakeStatusBar;
  window: FakeWindow;
} {
  const workspaceConfig = new FakeWorkspaceConfig();
  const connectionStore = new FakeConnectionStore();
  const secrets = new FakeSecrets();
  const session = new FakeSessionManager();
  const resultPanel = new FakeResultPanel();
  const statusBar = new FakeStatusBar();
  const window = new FakeWindow();

  return {
    workflow: new OracleCommandWorkflow({
      workspaceConfig,
      connectionStore,
      secrets,
      session,
      resultPanel,
      statusBar,
      window
    }),
    workspaceConfig,
    secrets,
    session,
    resultPanel,
    statusBar,
    window
  };
}

function document(text: string, selectionStart = 0, selectionEnd = 0): OracleWorkflowDocument {
  return {
    fileName: "E:/work/查客户信息.sql",
    text,
    selectionStart,
    selectionEnd
  };
}

describe("OracleCommandWorkflow", () => {
  it("switchConnection binds the selected connection by file name", async () => {
    const { workflow, workspaceConfig, statusBar } = createWorkflow();

    await workflow.switchConnection(document("select * from dual"));

    assert.strictEqual(workspaceConfig.bindings.get("查客户信息.sql"), "DEV_KGDB");
    assert.deepStrictEqual(statusBar.states.at(-1), {
      connectionName: "DEV_KGDB",
      hasUncommittedChanges: false
    });
  });

  it("runCurrentOrSelected prompts for password, saves it, executes selected SQL statements, and shows results", async () => {
    const { workflow, workspaceConfig, secrets, session, resultPanel, statusBar } = createWorkflow();
    await workspaceConfig.setConnectionForScript("查客户信息.sql", "DEV_KGDB");
    const sql = "select * from dual;\nselect * from customer;";
    const start = sql.indexOf("select * from customer");

    await workflow.runCurrentOrSelected(document(sql, start, sql.length));

    assert.deepStrictEqual(secrets.saved, [
      { connectionName: "DEV_KGDB", username: "kgdb", password: "secret-password" }
    ]);
    assert.deepStrictEqual(session.executed, ["select * from customer"]);
    assert.strictEqual(resultPanel.batches.length, 1);
    assert.strictEqual(resultPanel.batches[0].items[0].kind, "query");
    assert.deepStrictEqual(statusBar.states.at(-1), {
      connectionName: "DEV_KGDB",
      hasUncommittedChanges: false
    });
  });

  it("runCurrentOrSelected executes every statement in the selection", async () => {
    const { workflow, workspaceConfig, session, resultPanel } = createWorkflow();
    await workspaceConfig.setConnectionForScript("查客户信息.sql", "DEV_KGDB");
    const sql = "select * from dual;\nupdate customer set name = 'x';";

    await workflow.runCurrentOrSelected(document(sql, 0, sql.length));

    assert.deepStrictEqual(session.executed, [
      "select * from dual",
      "update customer set name = 'x'"
    ]);
    assert.strictEqual(resultPanel.batches[0].items.length, 2);
  });

  it("runCurrentOrSelected confirms before executing the whole script when there is no selection", async () => {
    const { workflow, workspaceConfig, session, window } = createWorkflow();
    await workspaceConfig.setConnectionForScript("查客户信息.sql", "DEV_KGDB");

    await workflow.runCurrentOrSelected(document("select 1 from dual;\nselect 2 from dual;", 0, 0));

    assert.deepStrictEqual(window.confirmations, [2]);
    assert.deepStrictEqual(session.executed, ["select 1 from dual", "select 2 from dual"]);
  });

  it("runCurrentOrSelected cancels whole-script execution when confirmation is declined", async () => {
    const { workflow, workspaceConfig, session, window } = createWorkflow();
    await workspaceConfig.setConnectionForScript("查客户信息.sql", "DEV_KGDB");
    window.confirm = false;

    await workflow.runCurrentOrSelected(document("select 1 from dual;", 0, 0));

    assert.deepStrictEqual(window.confirmations, [1]);
    assert.deepStrictEqual(session.executed, []);
  });

  it("shows Oracle execution errors in the result panel instead of throwing notifications", async () => {
    const { workflow, workspaceConfig, session, resultPanel, statusBar } = createWorkflow();
    await workspaceConfig.setConnectionForScript("鏌ュ鎴蜂俊鎭?sql", "DEV_KGDB");
    session.failOnSql = /missing_table/i;

    await workflow.runCurrentOrSelected(document("select * from missing_table;", 0, 0));

    assert.strictEqual(resultPanel.batches.length, 1);
    assert.strictEqual(resultPanel.batches[0].items[0].kind, "error");
    assert.match(resultPanel.batches[0].items[0].message, /ORA-00942/);
    assert.strictEqual(resultPanel.batches[0].items[0].startLine, 1);
    assert.deepStrictEqual(statusBar.states.at(-1), {
      connectionName: "DEV_KGDB",
      hasUncommittedChanges: false
    });
  });

  it("runScript executes each split statement and keeps all results in one batch", async () => {
    const { workflow, workspaceConfig, session, resultPanel, statusBar } = createWorkflow();
    await workspaceConfig.setConnectionForScript("查客户信息.sql", "DEV_KGDB");

    await workflow.runScript(
      document("select * from dual;\nupdate customer set name = 'x';\nselect * from customer;")
    );

    assert.deepStrictEqual(session.executed, [
      "select * from dual",
      "update customer set name = 'x'",
      "select * from customer"
    ]);
    assert.strictEqual(resultPanel.batches[0].items.length, 3);
    assert.deepStrictEqual(statusBar.states.at(-1), {
      connectionName: "DEV_KGDB",
      hasUncommittedChanges: true
    });
  });

  it("commit uses the file-bound connection and clears status", async () => {
    const { workflow, workspaceConfig, session, statusBar, resultPanel } = createWorkflow();
    await workspaceConfig.setConnectionForScript("查客户信息.sql", "DEV_KGDB");
    session.dirty = true;

    await workflow.commit(document("select * from dual"));

    assert.deepStrictEqual(session.committed, ["DEV_KGDB"]);
    assert.deepStrictEqual(statusBar.states.at(-1), {
      connectionName: "DEV_KGDB",
      hasUncommittedChanges: false
    });
    assert.strictEqual(resultPanel.batches.at(-1)?.items[0].kind, "message");
  });

  it("rollback uses the file-bound connection and clears status", async () => {
    const { workflow, workspaceConfig, session, statusBar } = createWorkflow();
    await workspaceConfig.setConnectionForScript("查客户信息.sql", "DEV_KGDB");
    session.dirty = true;

    await workflow.rollback(document("select * from dual"));

    assert.deepStrictEqual(session.rolledBack, ["DEV_KGDB"]);
    assert.deepStrictEqual(statusBar.states.at(-1), {
      connectionName: "DEV_KGDB",
      hasUncommittedChanges: false
    });
  });

  it("explainPlan executes explain plan and DBMS_XPLAN display in one result batch", async () => {
    const { workflow, workspaceConfig, session, resultPanel } = createWorkflow();
    await workspaceConfig.setConnectionForScript("查客户信息.sql", "DEV_KGDB");

    await workflow.explainPlan(document("select * from dual"));

    assert.deepStrictEqual(session.executed, [
      "explain plan for select * from dual",
      "select plan_table_output from table(dbms_xplan.display())"
    ]);
    assert.strictEqual(resultPanel.batches.length, 1);
    assert.strictEqual(resultPanel.batches[0].items.length, 2);
  });
});
