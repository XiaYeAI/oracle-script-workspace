import { ExecutionBatch, ExecutionResultItem } from "./resultModel";
import { escapeHtml, renderQueryTable, ResultTableLabels } from "./resultTableHtml";

export interface ResultPanelLabels {
  copyCell: string;
  copyRow: string;
  copyCsv: string;
  exportCsv: string;
  fetchNext: string;
  fetchAll: string;
  rows: string;
  moreRowsAvailable: string;
  rowsAffected: string;
  line: string;
  executionResults: string;
  text?: Record<string, string>;
}

const DEFAULT_LABELS: ResultPanelLabels = {
  copyCell: "Copy Cell",
  copyRow: "Copy Row",
  copyCsv: "Copy CSV",
  exportCsv: "Export CSV",
  fetchNext: "Fetch Next",
  fetchAll: "Fetch All",
  rows: "rows",
  moreRowsAvailable: "more rows available",
  rowsAffected: "rows affected",
  line: "Line",
  executionResults: "Execution Results"
};

export function renderResultPanelHtml(
  batch: ExecutionBatch,
  labels: ResultPanelLabels = DEFAULT_LABELS
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; }
    header { display: flex; gap: 12px; align-items: baseline; margin-bottom: 12px; }
    h1 { font-size: 16px; margin: 0; }
    .meta { color: var(--vscode-descriptionForeground); }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 10px; }
    .tab { color: var(--vscode-foreground); background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 6px 10px; }
    .tab.active { border-bottom-color: var(--vscode-focusBorder); background: var(--vscode-tab-activeBackground); }
    section { display: none; border: 1px solid var(--vscode-panel-border); margin-bottom: 12px; padding: 8px; }
    section.active { display: block; }
    h2 { font-size: 14px; margin: 0 0 8px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid var(--vscode-panel-border); padding: 4px 6px; text-align: left; }
    td.selected { outline: 2px solid var(--vscode-focusBorder); outline-offset: -2px; }
    th { background: var(--vscode-editor-lineHighlightBackground); }
    .toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 4px 8px; }
    button:disabled { opacity: .55; }
    .error { color: var(--vscode-errorForeground); white-space: pre-wrap; }
    .tableWrap { overflow: auto; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(batch.connectionName)}</h1>
    <span class="meta">${escapeHtml(batch.startedAt)}</span>
  </header>
  ${batch.items.some((item) => item.kind === "query")
    ? renderTabbedItems(batch.items, labels)
    : renderCombinedNonQueryItems(batch.items, labels)}
  <script>
    const vscode = acquireVsCodeApi();
    let selected = {};
    document.addEventListener("click", event => {
      const tab = event.target.closest(".tab");
      if (tab) {
        document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab));
        document.querySelectorAll("section[data-panel]").forEach(item => item.classList.toggle("active", item.dataset.panel === tab.dataset.tab));
        return;
      }
      const cell = event.target.closest("td[data-row]");
      if (cell) {
        document.querySelectorAll("td.selected").forEach(item => item.classList.remove("selected"));
        cell.classList.add("selected");
        selected = { row: Number(cell.dataset.row), column: Number(cell.dataset.column) };
        return;
      }
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      vscode.postMessage({
        action: button.dataset.action,
        index: Number(button.dataset.index),
        row: selected.row,
        column: selected.column
      });
    });
  </script>
</body>
</html>`;
}

function renderTabbedItems(items: ExecutionResultItem[], labels: ResultPanelLabels): string {
  const tableLabels = {
    copyCell: labels.copyCell,
    copyRow: labels.copyRow,
    copyCsv: labels.copyCsv,
    exportCsv: labels.exportCsv,
    fetchNext: labels.fetchNext,
    fetchAll: labels.fetchAll
  };
  return `<div class="tabs">
    ${items.map((item, index) => `<button class="tab ${index === 0 ? "active" : ""}" data-tab="${index}">${escapeHtml(localizeText(item.title, labels))}</button>`).join("")}
  </div>
  ${items.map((item, index) => renderItem(item, index, labels, tableLabels)).join("\n")}`;
}

function renderCombinedNonQueryItems(items: ExecutionResultItem[], labels: ResultPanelLabels): string {
  return `<section data-panel="0" class="active">
  <h2>${escapeHtml(labels.executionResults)}</h2>
  ${items.map((item) => renderNonQuerySummaryItem(item, labels)).join("\n")}
</section>`;
}

function renderNonQuerySummaryItem(item: ExecutionResultItem, labels: ResultPanelLabels): string {
  if (item.kind === "update") {
    return `<div class="meta"><strong>${escapeHtml(localizeText(item.title, labels))}</strong></div>
  <div>${item.rowsAffected} ${escapeHtml(labels.rowsAffected)}, ${item.elapsedMs} ms</div>`;
  }

  if (item.kind === "message") {
    return `<div class="meta"><strong>${escapeHtml(localizeText(item.title, labels))}</strong></div>
  <div>${escapeHtml(localizeText(item.message, labels))}${typeof item.elapsedMs === "number" ? `, ${item.elapsedMs} ms` : ""}</div>`;
  }

  if (item.kind === "error") {
    return `<div class="meta"><strong>${escapeHtml(localizeText(item.title, labels))}</strong></div>
  <div class="error">${escapeHtml(item.message)}</div>
  ${item.startLine ? `<div class="meta">${escapeHtml(labels.line)} ${item.startLine}</div>` : ""}`;
  }

  return "";
}

function renderItem(item: ExecutionResultItem, index: number, labels: ResultPanelLabels, tableLabels: ResultTableLabels): string {
  if (item.kind === "query") {
    return `<section data-panel="${index}" class="${index === 0 ? "active" : ""}">
  <h2>${escapeHtml(localizeText(item.title, labels))}</h2>
  <div class="meta">${item.rows.length} ${escapeHtml(labels.rows)}, ${item.elapsedMs} ms${item.hasMoreRows ? `, ${escapeHtml(labels.moreRowsAvailable)}` : ""}</div>
  ${renderQueryTable(index, item.columns, item.rows, item.hasMoreRows, tableLabels)}
</section>`;
  }

  if (item.kind === "update") {
    return `<section data-panel="${index}" class="${index === 0 ? "active" : ""}">
  <h2>${escapeHtml(localizeText(item.title, labels))}</h2>
  <div>${item.rowsAffected} ${escapeHtml(labels.rowsAffected)}, ${item.elapsedMs} ms</div>
</section>`;
  }

  if (item.kind === "message") {
    return `<section data-panel="${index}" class="${index === 0 ? "active" : ""}">
  <h2>${escapeHtml(localizeText(item.title, labels))}</h2>
  <div>${escapeHtml(localizeText(item.message, labels))}${typeof item.elapsedMs === "number" ? `, ${item.elapsedMs} ms` : ""}</div>
</section>`;
  }

  return `<section data-panel="${index}" class="${index === 0 ? "active" : ""}">
  <h2>${escapeHtml(localizeText(item.title, labels))}</h2>
  <div class="error">${escapeHtml(item.message)}</div>
  ${item.startLine ? `<div class="meta">${escapeHtml(labels.line)} ${item.startLine}</div>` : ""}
</section>`;
}

function localizeText(text: string, labels: ResultPanelLabels): string {
  return labels.text?.[text] ?? text;
}
