import * as vscode from "vscode";
import { ExecutionBatch } from "./resultModel";
import { renderResultPanelHtml } from "./resultPanelHtml";
import { toCsv } from "./resultCsv";

export class ResultPanel implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private batch: ExecutionBatch | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message) => this.handleMessage(message));
    this.render();
  }

  show(batch: ExecutionBatch): void {
    this.batch = batch;
    this.render();
    void vscode.commands.executeCommand("oracleWorkspace.results.focus");
  }

  dispose(): void {
    this.view = undefined;
  }

  private render(): void {
    if (!this.view) {
      return;
    }

    this.view.webview.html = this.batch ? renderResultPanelHtml(this.batch, {
      copyCell: vscode.l10n.t("Copy Cell"),
      copyRow: vscode.l10n.t("Copy Row"),
      copyCsv: vscode.l10n.t("Copy CSV"),
      exportCsv: vscode.l10n.t("Export CSV"),
      fetchNext: vscode.l10n.t("Fetch Next"),
      fetchAll: vscode.l10n.t("Fetch All"),
      rows: vscode.l10n.t("rows"),
      moreRowsAvailable: vscode.l10n.t("more rows available"),
      rowsAffected: vscode.l10n.t("rows affected"),
      line: vscode.l10n.t("Line"),
      executionResults: vscode.l10n.t("Execution Results"),
      text: createResultTextLabels()
    }) : renderEmptyResults();
  }

  private async handleMessage(message: { action?: string; index?: number; row?: number; column?: number }): Promise<void> {
    if (!this.batch || typeof message.index !== "number") {
      return;
    }

    const item = this.batch.items[message.index];
    if (!item || item.kind !== "query") {
      return;
    }

    if (message.action === "copyCell") {
      const value = typeof message.row === "number" && typeof message.column === "number"
        ? item.rows[message.row]?.[message.column]
        : undefined;
      await vscode.env.clipboard.writeText(value === undefined || value === null ? "" : String(value));
      return;
    }

    if (message.action === "copyRow") {
      const row = typeof message.row === "number" ? item.rows[message.row] : undefined;
      await vscode.env.clipboard.writeText(row ? toCsv(item.columns, [row]).split(/\r?\n/).slice(1).join("") : "");
      return;
    }

    if (message.action === "fetchNext" || message.action === "fetchAll") {
      await vscode.window.showInformationMessage(vscode.l10n.t("Cursor pagination is not available in this version."));
      return;
    }

    const csv = toCsv(item.columns, item.rows);
    if (message.action === "copyCsv") {
      await vscode.env.clipboard.writeText(csv);
      await vscode.window.showInformationMessage(vscode.l10n.t("Result CSV copied."));
      return;
    }

    if (message.action === "exportCsv") {
      const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(this.extensionUri, `${item.title.replace(/\W+/g, "_")}.csv`),
        filters: { CSV: ["csv"] }
      });
      if (target) {
        await vscode.workspace.fs.writeFile(target, Buffer.from(csv, "utf8"));
      }
    }
  }
}

function renderEmptyResults(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body>
    <div style="font-family: var(--vscode-font-family); color: var(--vscode-descriptionForeground); padding: 12px;">
      ${vscode.l10n.t("Run SQL to show results here.")}
    </div>
  </body></html>`;
}

function createResultTextLabels(): Record<string, string> {
  return {
    "Query Result": vscode.l10n.t("Query Result"),
    "Update Count": vscode.l10n.t("Update Count"),
    "Error": vscode.l10n.t("Error"),
    "Commit": vscode.l10n.t("Commit"),
    "Rollback": vscode.l10n.t("Rollback"),
    "Grant": vscode.l10n.t("Grant"),
    "Revoke": vscode.l10n.t("Revoke"),
    "Create": vscode.l10n.t("Create"),
    "Alter": vscode.l10n.t("Alter"),
    "Drop": vscode.l10n.t("Drop"),
    "Truncate": vscode.l10n.t("Truncate"),
    "Comment": vscode.l10n.t("Comment"),
    "Analyze": vscode.l10n.t("Analyze"),
    "PL/SQL Block": vscode.l10n.t("PL/SQL Block"),
    "Commit succeeded.": vscode.l10n.t("Commit succeeded."),
    "Rollback succeeded.": vscode.l10n.t("Rollback succeeded."),
    "Grant succeeded.": vscode.l10n.t("Grant succeeded."),
    "Revoke succeeded.": vscode.l10n.t("Revoke succeeded."),
    "Create succeeded.": vscode.l10n.t("Create succeeded."),
    "Alter succeeded.": vscode.l10n.t("Alter succeeded."),
    "Drop succeeded.": vscode.l10n.t("Drop succeeded."),
    "Truncate succeeded.": vscode.l10n.t("Truncate succeeded."),
    "Comment succeeded.": vscode.l10n.t("Comment succeeded."),
    "Analyze succeeded.": vscode.l10n.t("Analyze succeeded."),
    "PL/SQL Block succeeded.": vscode.l10n.t("PL/SQL Block succeeded.")
  };
}
