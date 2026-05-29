import * as path from "path";
import { OracleConnectionConfig } from "../config/connectionConfig";
import { OracleExecutionResult } from "../connections/oracleAdapter";
import { OracleSessionManager } from "../connections/oracleSessionManager";
import { createErrorBatch, createExecutionBatch, createMessageBatch, ExecutionBatch } from "../results/resultModel";
import { splitOracleScript } from "../sql/sqlSplitter";
import { resolveCurrentOrSelectedSql, resolveScriptSql } from "../sql/sqlTextResolver";

export interface OracleWorkflowDocument {
  fileName: string;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface OracleWorkflowWorkspaceConfig {
  getConnectionForScript(fileName: string): Promise<string | undefined>;
  setConnectionForScript(fileName: string, connectionName: string): Promise<void>;
}

export interface OracleWorkflowConnectionStore {
  listConfiguredConnections(): OracleConnectionConfig[];
  getConnection(connectionName: string): OracleConnectionConfig | undefined;
}

export interface OracleWorkflowSecrets {
  getPassword(connectionName: string, username: string): Promise<string | undefined>;
  savePassword(connectionName: string, username: string, password: string): Promise<void>;
}

export interface OracleWorkflowSession {
  execute(connectionName: string, sql: string): Promise<OracleExecutionResult>;
  commit(connectionName: string): Promise<void>;
  rollback(connectionName: string): Promise<void>;
  hasUncommittedChanges(connectionName: string): boolean;
}

export interface OracleWorkflowWindow {
  pickConnection(connectionNames: string[]): Promise<string | undefined>;
  inputPassword(connectionName: string, username: string): Promise<string | undefined>;
  confirmRunScript(statementCount: number): Promise<boolean>;
  showInformationMessage(message: string): Promise<void>;
  showErrorMessage(message: string): Promise<void>;
}

export interface OracleWorkflowResultPanel {
  show(batch: ExecutionBatch): void;
}

export interface OracleWorkflowStatusBar {
  update(state: { connectionName?: string; hasUncommittedChanges: boolean }): void;
}

export interface OracleCommandWorkflowServices {
  workspaceConfig: OracleWorkflowWorkspaceConfig;
  connectionStore: OracleWorkflowConnectionStore;
  secrets: OracleWorkflowSecrets;
  session: OracleWorkflowSession;
  resultPanel: OracleWorkflowResultPanel;
  statusBar: OracleWorkflowStatusBar;
  window: OracleWorkflowWindow;
  beforeSwitchConnection?: (currentConnectionName?: string) => Promise<"continue" | "cancel">;
}

export class OracleCommandWorkflow {
  constructor(private readonly services: OracleCommandWorkflowServices) {}

  async switchConnection(document: OracleWorkflowDocument): Promise<string | undefined> {
    const current = await this.services.workspaceConfig.getConnectionForScript(path.basename(document.fileName));
    const decision = await this.services.beforeSwitchConnection?.(current);
    if (decision === "cancel") {
      return undefined;
    }

    const connectionName = await this.pickConnection();
    if (!connectionName) {
      return undefined;
    }

    await this.services.workspaceConfig.setConnectionForScript(
      path.basename(document.fileName),
      connectionName
    );
    this.updateStatus(connectionName);

    return connectionName;
  }

  async runCurrentOrSelected(document: OracleWorkflowDocument): Promise<void> {
    const connectionName = await this.ensureConnection(document);
    if (!connectionName) {
      return;
    }

    await this.ensurePassword(connectionName);
    const resolved = document.selectionEnd > document.selectionStart
      ? resolveCurrentOrSelectedSql(document.text, document.selectionStart, document.selectionEnd)
      : resolveScriptSql(document.text);
    const statements = splitOracleScript(resolved.sql);
    if (resolved.source === "script") {
      const confirmed = await this.services.window.confirmRunScript(statements.length);
      if (!confirmed) {
        return;
      }
    }

    const results = await this.executeStatements(connectionName, statements, resolved.startLine);
    if (!results) {
      return;
    }
    this.services.resultPanel.show(createExecutionBatch(
      connectionName,
      results,
      statements.map((statement) => statement.sql)
    ));
    this.updateStatus(connectionName);
  }

  async runScript(document: OracleWorkflowDocument): Promise<void> {
    const connectionName = await this.ensureConnection(document);
    if (!connectionName) {
      return;
    }

    await this.ensurePassword(connectionName);
    const statements = splitOracleScript(document.text);
    const results = await this.executeStatements(connectionName, statements, 1);
    if (!results) {
      return;
    }

    this.services.resultPanel.show(createExecutionBatch(
      connectionName,
      results,
      statements.map((statement) => statement.sql)
    ));
    this.updateStatus(connectionName);
  }

  async explainPlan(document: OracleWorkflowDocument): Promise<void> {
    const connectionName = await this.ensureConnection(document);
    if (!connectionName) {
      return;
    }

    await this.ensurePassword(connectionName);
    const resolved = resolveCurrentOrSelectedSql(
      document.text,
      document.selectionStart,
      document.selectionEnd
    );
    const results: OracleExecutionResult[] = [];
    try {
      results.push(await this.services.session.execute(connectionName, `explain plan for ${resolved.sql}`));
      results.push(
        await this.services.session.execute(
          connectionName,
          "select plan_table_output from table(dbms_xplan.display())"
        )
      );
    } catch (error) {
      this.showExecutionError(connectionName, error, resolved.startLine);
      return;
    }

    this.services.resultPanel.show(createExecutionBatch(connectionName, results));
    this.updateStatus(connectionName);
  }

  async commit(document: OracleWorkflowDocument): Promise<void> {
    const connectionName = await this.ensureConnection(document);
    if (!connectionName) {
      return;
    }

    await this.ensurePassword(connectionName);
    await this.services.session.commit(connectionName);
    this.services.resultPanel.show(createMessageBatch(connectionName, "Commit", "Commit succeeded."));
    this.updateStatus(connectionName);
  }

  async rollback(document: OracleWorkflowDocument): Promise<void> {
    const connectionName = await this.ensureConnection(document);
    if (!connectionName) {
      return;
    }

    await this.ensurePassword(connectionName);
    await this.services.session.rollback(connectionName);
    this.services.resultPanel.show(createMessageBatch(connectionName, "Rollback", "Rollback succeeded."));
    this.updateStatus(connectionName);
  }

  private async ensureConnection(document: OracleWorkflowDocument): Promise<string | undefined> {
    const fileName = path.basename(document.fileName);
    const bound = await this.services.workspaceConfig.getConnectionForScript(fileName);
    if (bound && this.services.connectionStore.getConnection(bound)) {
      return bound;
    }

    return this.switchConnection(document);
  }

  private async ensurePassword(connectionName: string): Promise<void> {
    const connection = this.services.connectionStore.getConnection(connectionName);
    if (!connection) {
      throw new Error(`Connection '${connectionName}' is not configured.`);
    }

    const existing = await this.services.secrets.getPassword(connectionName, connection.username);
    if (existing) {
      return;
    }

    const password = await this.services.window.inputPassword(connectionName, connection.username);
    if (!password) {
      throw new Error(`Password for connection '${connectionName}' was not provided.`);
    }

    await this.services.secrets.savePassword(connectionName, connection.username, password);
  }

  private async pickConnection(): Promise<string | undefined> {
    const connectionNames = this.services.connectionStore
      .listConfiguredConnections()
      .map((connection) => connection.name);

    if (connectionNames.length === 0) {
      await this.services.window.showErrorMessage("No Oracle connections are configured.");
      return undefined;
    }

    return this.services.window.pickConnection(connectionNames);
  }

  private updateStatus(connectionName: string): void {
    this.services.statusBar.update({
      connectionName,
      hasUncommittedChanges: this.services.session.hasUncommittedChanges(connectionName)
    });
  }

  private async executeStatements(
    connectionName: string,
    statements: Array<{ sql: string; startLine: number }>,
    baseStartLine: number
  ): Promise<OracleExecutionResult[] | undefined> {
    const results: OracleExecutionResult[] = [];
    for (const statement of statements) {
      try {
        results.push(await this.services.session.execute(connectionName, statement.sql));
      } catch (error) {
        this.showExecutionError(connectionName, error, baseStartLine + statement.startLine - 1);
        return undefined;
      }
    }
    return results;
  }

  private showExecutionError(connectionName: string, error: unknown, startLine?: number): void {
    this.services.resultPanel.show(createErrorBatch(connectionName, toErrorMessage(error), startLine));
    this.updateStatus(connectionName);
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createWorkflowDocumentFromText(
  fileName: string,
  text: string,
  selectionStart = 0,
  selectionEnd = 0
): OracleWorkflowDocument {
  return { fileName, text, selectionStart, selectionEnd };
}

export function createSessionProvider(
  sessionManager: OracleSessionManager
): OracleWorkflowSession {
  return sessionManager;
}
