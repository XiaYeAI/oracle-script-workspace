import * as vscode from "vscode";
import { createScriptBindingNodes, ScriptBindingNode } from "./scriptBindingModel";

export interface ScriptBindingSource {
  getActiveScriptFileName(): string | undefined;
  getConnectionForScript(fileName: string): Promise<string | undefined>;
  hasUncommittedChanges(connectionName: string): boolean;
}

export class ScriptBindingProvider implements vscode.TreeDataProvider<ScriptBindingNode>, vscode.Disposable {
  private readonly didChangeTreeData = new vscode.EventEmitter<ScriptBindingNode | undefined>();
  private readonly disposables: vscode.Disposable[] = [];
  readonly onDidChangeTreeData = this.didChangeTreeData.event;

  constructor(private readonly source: ScriptBindingSource) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
      vscode.workspace.onDidSaveTextDocument(() => this.refresh())
    );
  }

  refresh(): void {
    this.didChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ScriptBindingNode): vscode.TreeItem {
    if (element.kind === "message") {
      return new vscode.TreeItem(localizeScriptLabel(element.label), vscode.TreeItemCollapsibleState.None);
    }

    if (element.kind === "field") {
      const item = new vscode.TreeItem(localizeScriptLabel(element.label), vscode.TreeItemCollapsibleState.None);
      item.description = localizeScriptDescription(element.description);
      item.iconPath = element.icon ? new vscode.ThemeIcon(element.icon) : undefined;
      return item;
    }

    const item = new vscode.TreeItem(localizeScriptLabel(element.label), vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(element.icon);
    item.command = {
      command: element.command,
      title: element.label
    };
    return item;
  }

  async getChildren(element?: ScriptBindingNode): Promise<ScriptBindingNode[]> {
    if (element) {
      return [];
    }

    const activeFile = this.source.getActiveScriptFileName();
    if (!activeFile) {
      return createScriptBindingNodes(undefined, undefined, false);
    }

    const connectionName = await this.source.getConnectionForScript(activeFile);
    return createScriptBindingNodes(
      activeFile,
      connectionName,
      connectionName ? this.source.hasUncommittedChanges(connectionName) : false
    );
  }

  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.didChangeTreeData.dispose();
  }
}

function localizeScriptLabel(label: string): string {
  switch (label) {
    case "Open a .sql file to see its workspace.":
      return vscode.l10n.t("Open a .sql file to see its workspace.");
    case "File":
      return vscode.l10n.t("File");
    case "Connection":
      return vscode.l10n.t("Connection");
    case "Transaction":
      return vscode.l10n.t("Transaction");
    case "Switch Connection":
      return vscode.l10n.t("Switch Connection");
    case "Run Current":
      return vscode.l10n.t("Run Current");
    case "Run Script":
      return vscode.l10n.t("Run Script");
    case "Commit":
      return vscode.l10n.t("Commit");
    case "Rollback":
      return vscode.l10n.t("Rollback");
    default:
      return label;
  }
}

function localizeScriptDescription(description: string): string {
  switch (description) {
    case "Not bound":
      return vscode.l10n.t("Not bound");
    case "uncommitted":
      return vscode.l10n.t("uncommitted");
    case "clean":
      return vscode.l10n.t("clean");
    default:
      return description;
  }
}
