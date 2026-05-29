import * as path from "path";
import * as vscode from "vscode";
import { ConnectionConfigStore } from "../config/connectionConfig";
import { WorkspaceConfigStore } from "../config/workspaceConfig";
import { OracleSessionManager } from "../connections/oracleSessionManager";
import { renderCurrentScriptHtml } from "./currentScriptHtml";

export interface CurrentScriptProviderOptions {
  connectionConfig: ConnectionConfigStore;
  workspaceConfig: WorkspaceConfigStore;
  sessionManager: OracleSessionManager;
}

export class CurrentScriptProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly options: CurrentScriptProviderOptions) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
      vscode.workspace.onDidSaveTextDocument(() => this.refresh())
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message: { action?: string }) => this.handleMessage(message));
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    const fileName = editor?.document.languageId === "sql" ? editor.document.fileName : undefined;
    const connectionName = fileName
      ? await this.options.workspaceConfig.getConnectionForScript(path.basename(fileName))
      : undefined;
    const connection = connectionName ? this.options.connectionConfig.getConnection(connectionName) : undefined;

    this.view.webview.html = renderCurrentScriptHtml(
      {
        fileName,
        connectionName,
        connection,
        hasUncommittedChanges: connectionName ? this.options.sessionManager.hasUncommittedChanges(connectionName) : false,
        maxRows: this.options.connectionConfig.getMaxRows()
      },
      {
        noSqlFile: vscode.l10n.t("Open a .sql file to see its workspace."),
        connection: vscode.l10n.t("Connection"),
        user: vscode.l10n.t("User"),
        source: vscode.l10n.t("Source"),
        transaction: vscode.l10n.t("Transaction"),
        rowsLimit: vscode.l10n.t("Rows limit"),
        notBound: vscode.l10n.t("Not bound"),
        missingConnection: vscode.l10n.t("Missing connection"),
        clean: vscode.l10n.t("clean"),
        uncommitted: vscode.l10n.t("uncommitted"),
        switchConnection: vscode.l10n.t("Switch Connection"),
        bindConnection: vscode.l10n.t("Bind Connection"),
        addConnection: vscode.l10n.t("Add Connection"),
        runCurrent: vscode.l10n.t("Run Current"),
        runScript: vscode.l10n.t("Run Script"),
        explainPlan: vscode.l10n.t("Explain Plan"),
        commit: vscode.l10n.t("Commit"),
        rollback: vscode.l10n.t("Rollback")
      }
    );
  }

  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  private async handleMessage(message: { action?: string }): Promise<void> {
    const commandByAction: Record<string, string> = {
      switchConnection: "oracleWorkspace.switchConnection",
      addConnection: "oracleWorkspace.addConnection",
      runCurrent: "oracleWorkspace.runCurrentOrSelected",
      runScript: "oracleWorkspace.runScript",
      explainPlan: "oracleWorkspace.explainPlan",
      commit: "oracleWorkspace.commit",
      rollback: "oracleWorkspace.rollback"
    };
    const command = message.action ? commandByAction[message.action] : undefined;
    if (command) {
      await vscode.commands.executeCommand(command);
      await this.refresh();
    }
  }
}
