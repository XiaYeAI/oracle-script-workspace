import { ObjectDetailsRequest, ObjectDetailsTab } from "./objectDetailsPanel";

export interface ObjectDetailsHtmlLabels {
  noRows: string;
  refresh: string;
  copy: string;
  openAsSql: string;
  type: string;
  connection: string;
}

const DEFAULT_LABELS: ObjectDetailsHtmlLabels = {
  noRows: "No rows",
  refresh: "Refresh",
  copy: "Copy",
  openAsSql: "Open as SQL",
  type: "Type",
  connection: "Connection"
};

export function renderObjectDetailsHtml(
  request: ObjectDetailsRequest,
  tabs: ObjectDetailsTab[],
  labels: ObjectDetailsHtmlLabels = DEFAULT_LABELS
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; }
    header { margin-bottom: 12px; }
    h1 { font-size: 16px; margin: 0; }
    .meta { color: var(--vscode-descriptionForeground); margin-top: 4px; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 10px; }
    .tab { color: var(--vscode-foreground); background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 6px 10px; }
    .tab.active { border-bottom-color: var(--vscode-focusBorder); background: var(--vscode-tab-activeBackground); }
    section { display: none; border: 1px solid var(--vscode-panel-border); margin-bottom: 12px; padding: 8px; }
    section.active { display: block; }
    h2 { font-size: 14px; margin: 0 0 8px; }
    pre { background: var(--vscode-textCodeBlock-background); padding: 8px; overflow: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid var(--vscode-panel-border); padding: 4px 6px; text-align: left; }
    th { background: var(--vscode-editor-lineHighlightBackground); }
    .toolbar { display: flex; gap: 8px; margin: 8px 0 10px; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 4px 8px; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(request.owner)}.${escapeHtml(request.objectName)}</h1>
    <div class="meta">${escapeHtml(labels.connection)}: ${escapeHtml(request.connectionName)}${request.objectType ? ` · ${escapeHtml(labels.type)}: ${escapeHtml(request.objectType)}` : ""}</div>
  </header>
  <div class="toolbar">
    <button data-action="refresh">${escapeHtml(labels.refresh)}</button>
    <button data-action="copy">${escapeHtml(labels.copy)}</button>
    <button data-action="openAsSql">${escapeHtml(labels.openAsSql)}</button>
  </div>
  <div class="tabs">
    ${tabs.map((tab, index) => `<button class="tab ${index === 0 ? "active" : ""}" data-tab="${index}">${escapeHtml(tab.title)}</button>`).join("")}
  </div>
  ${tabs.map((tab, index) => renderTab(tab, labels, index)).join("\n")}
  <script>
    const vscode = acquireVsCodeApi();
    let active = 0;
    document.addEventListener("click", event => {
      const tab = event.target.closest(".tab");
      if (tab) {
        active = Number(tab.dataset.tab);
        document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab));
        document.querySelectorAll("section[data-panel]").forEach(item => item.classList.toggle("active", item.dataset.panel === tab.dataset.tab));
        return;
      }
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      vscode.postMessage({ action: button.dataset.action, index: active });
    });
  </script>
</body>
</html>`;
}

function renderTab(tab: ObjectDetailsTab, labels: ObjectDetailsHtmlLabels, index: number): string {
  if (tab.kind === "code") {
    return `<section data-panel="${index}" class="${index === 0 ? "active" : ""}"><h2>${escapeHtml(tab.title)}</h2><pre><code>${escapeHtml(String(tab.content ?? ""))}</code></pre></section>`;
  }

  if (tab.kind === "table" && Array.isArray(tab.content)) {
    return `<section data-panel="${index}" class="${index === 0 ? "active" : ""}"><h2>${escapeHtml(tab.title)}</h2>${renderTable(tab.content, labels)}</section>`;
  }

  return `<section data-panel="${index}" class="${index === 0 ? "active" : ""}"><h2>${escapeHtml(tab.title)}</h2><div>${escapeHtml(String(tab.content ?? ""))}</div></section>`;
}

function renderTable(rows: unknown[], labels: ObjectDetailsHtmlLabels): string {
  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== "object") {
    return `<div>${escapeHtml(labels.noRows)}</div>`;
  }

  const columns = Object.keys(firstRow as Record<string, unknown>);

  return `<table>
    <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows
        .map((row) => {
          const record = row as Record<string, unknown>;
          return `<tr>${columns.map((column) => `<td>${escapeHtml(String(record[column] ?? ""))}</td>`).join("")}</tr>`;
        })
        .join("\n")}
    </tbody>
  </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
