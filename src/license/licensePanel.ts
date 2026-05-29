import * as vscode from "vscode";
import { LicenseService, LicenseState } from "./licenseService";

export class LicensePanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly licenseService: LicenseService) {}

  async show(): Promise<void> {
    const state = await this.licenseService.getState();

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "oracleWorkspace.license",
        vscode.l10n.t("Oracle Script Workspace License"),
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
      this.panel.webview.onDidReceiveMessage((message: { action?: string }) => this.handleMessage(message));
    }

    this.panel.webview.html = renderLicenseHtml(state);
    this.panel.reveal(vscode.ViewColumn.Active);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async handleMessage(message: { action?: string }): Promise<void> {
    if (message.action === "signIn") {
      await this.licenseService.signInPlaceholder();
    } else if (message.action === "signOut") {
      await this.licenseService.signOut();
    }
    await this.show();
  }
}

function renderLicenseHtml(state: LicenseState): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; }
    dt { color: var(--vscode-descriptionForeground); }
    .toolbar { display: flex; gap: 8px; margin-top: 14px; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 5px 10px; }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  </style>
</head>
<body>
  <h1>${escapeHtml(vscode.l10n.t("Oracle Script Workspace License"))}</h1>
  <dl>
    <dt>${escapeHtml(vscode.l10n.t("Current plan"))}</dt><dd>${escapeHtml(state.plan)}</dd>
    <dt>${escapeHtml(vscode.l10n.t("Status"))}</dt><dd>${escapeHtml(state.status)}</dd>
    <dt>${escapeHtml(vscode.l10n.t("Email"))}</dt><dd>${escapeHtml(state.email ?? vscode.l10n.t("Not signed in"))}</dd>
  </dl>
  <p>${escapeHtml(vscode.l10n.t("Subscription features are not enforced in this version."))}</p>
  <div class="toolbar">
    <button data-action="signIn">${escapeHtml(vscode.l10n.t("Sign in"))}</button>
    <button class="secondary" data-action="signOut">${escapeHtml(vscode.l10n.t("Sign out"))}</button>
    <button class="secondary" data-action="refresh">${escapeHtml(vscode.l10n.t("Refresh License"))}</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (button) vscode.postMessage({ action: button.dataset.action });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
