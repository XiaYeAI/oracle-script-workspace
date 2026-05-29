export interface ResultTableLabels {
  copyCell: string;
  copyRow: string;
  copyCsv: string;
  exportCsv: string;
  fetchNext: string;
  fetchAll: string;
}

export function renderQueryTable(
  index: number,
  columns: string[],
  rows: unknown[][],
  hasMoreRows: boolean,
  labels: ResultTableLabels
): string {
  return `<div class="toolbar">
    <button data-action="copyCell" data-index="${index}">${escapeHtml(labels.copyCell)}</button>
    <button data-action="copyRow" data-index="${index}">${escapeHtml(labels.copyRow)}</button>
    <button data-action="copyCsv" data-index="${index}">${escapeHtml(labels.copyCsv)}</button>
    <button data-action="exportCsv" data-index="${index}">${escapeHtml(labels.exportCsv)}</button>
    <button data-action="fetchNext" data-index="${index}" ${hasMoreRows ? "" : "disabled"}>${escapeHtml(labels.fetchNext)}</button>
    <button data-action="fetchAll" data-index="${index}" ${hasMoreRows ? "" : "disabled"}>${escapeHtml(labels.fetchAll)}</button>
  </div>
  <div class="tableWrap">
    <table data-result-index="${index}">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row, rowIndex) => `<tr>${row.map((cell, columnIndex) => `<td data-row="${rowIndex}" data-column="${columnIndex}">${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`).join("\n")}
      </tbody>
    </table>
  </div>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
