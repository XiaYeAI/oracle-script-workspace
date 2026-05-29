import * as path from "path";
import { OracleConnectionConfig } from "../config/connectionConfig";

export interface CurrentScriptState {
  fileName?: string;
  connectionName?: string;
  connection?: OracleConnectionConfig;
  hasUncommittedChanges: boolean;
  maxRows: number;
}

export interface CurrentScriptLabels {
  noSqlFile: string;
  connection: string;
  user: string;
  source: string;
  transaction: string;
  rowsLimit: string;
  notBound: string;
  missingConnection: string;
  clean: string;
  uncommitted: string;
  switchConnection: string;
  bindConnection: string;
  addConnection: string;
  runCurrent: string;
  runScript: string;
  explainPlan: string;
  commit: string;
  rollback: string;
}

const DEFAULT_LABELS: CurrentScriptLabels = {
  noSqlFile: "Open a .sql file to see its workspace.",
  connection: "Connection",
  user: "User",
  source: "Source",
  transaction: "Transaction",
  rowsLimit: "Rows limit",
  notBound: "Not bound",
  missingConnection: "Missing connection",
  clean: "clean",
  uncommitted: "uncommitted",
  switchConnection: "Switch Connection",
  bindConnection: "Bind Connection",
  addConnection: "Add Connection",
  runCurrent: "Run Current",
  runScript: "Run Script",
  explainPlan: "Explain Plan",
  commit: "Commit",
  rollback: "Rollback"
};

export function renderCurrentScriptHtml(
  state: CurrentScriptState,
  labels: CurrentScriptLabels = DEFAULT_LABELS
): string {
  if (!state.fileName) {
    return shell(`<div class="empty">${escape(labels.noSqlFile)}</div>`);
  }

  const fileLabel = path.basename(state.fileName);
  const connectionLabel = state.connection
    ? state.connection.name
    : state.connectionName
      ? `${state.connectionName} (${labels.missingConnection})`
      : labels.notBound;
  const transaction = state.hasUncommittedChanges ? labels.uncommitted : labels.clean;

  return shell(`
    <h1>${escape(fileLabel)}</h1>
    <dl>
      <dt>${escape(labels.connection)}</dt><dd>${escape(connectionLabel)}</dd>
      <dt>${escape(labels.user)}</dt><dd>${escape(state.connection?.username ?? "-")}</dd>
      <dt>${escape(labels.source)}</dt><dd>${escape(state.connection?.type ?? "-")}</dd>
      <dt>${escape(labels.transaction)}</dt><dd class="${state.hasUncommittedChanges ? "warn" : ""}">${escape(transaction)}</dd>
      <dt>${escape(labels.rowsLimit)}</dt><dd>${state.maxRows}</dd>
    </dl>
    <div class="actions">
      <button data-command="switchConnection">${escape(state.connectionName ? labels.switchConnection : labels.bindConnection)}</button>
      <button data-command="addConnection">${escape(labels.addConnection)}</button>
      <button data-command="runCurrent" ${state.connection ? "" : "disabled"}>${escape(labels.runCurrent)}</button>
      <button data-command="runScript" ${state.connection ? "" : "disabled"}>${escape(labels.runScript)}</button>
      <button data-command="explainPlan" ${state.connection ? "" : "disabled"}>${escape(labels.explainPlan)}</button>
      <button data-command="commit" ${state.connection ? "" : "disabled"}>${escape(labels.commit)}</button>
      <button data-command="rollback" ${state.connection ? "" : "disabled"}>${escape(labels.rollback)}</button>
    </div>
  `);
}

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 10px; }
    h1 { font-size: 14px; margin: 0 0 10px; overflow-wrap: anywhere; }
    dl { display: grid; grid-template-columns: max-content minmax(0,1fr); gap: 5px 10px; margin: 0 0 12px; }
    dt { color: var(--vscode-descriptionForeground); }
    dd { margin: 0; overflow-wrap: anywhere; }
    .warn { color: var(--vscode-editorWarning-foreground); font-weight: 600; }
    .actions { display: grid; gap: 6px; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 5px 8px; text-align: left; }
    button:disabled { opacity: .55; }
    .empty { color: var(--vscode-descriptionForeground); padding: 8px 0; }
  </style>
</head>
<body>
  ${content}
  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener("click", event => {
      const button = event.target.closest("button[data-command]");
      if (!button || button.disabled) return;
      vscode.postMessage({ action: button.dataset.command });
    });
  </script>
</body>
</html>`;
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
