import * as vscode from "vscode";

export interface StatusBarState {
  connectionName?: string;
  hasUncommittedChanges: boolean;
}

export class StatusBarController {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = "oracleWorkspace.switchConnection";
    this.item.tooltip = "Switch Oracle Script Workspace connection";
    this.update({ hasUncommittedChanges: false });
    this.item.show();
  }

  update(state: StatusBarState): void {
    if (!state.connectionName) {
      this.item.text = vscode.l10n.t("$(database) Oracle: No connection selected");
      return;
    }

    this.item.text = state.hasUncommittedChanges
      ? vscode.l10n.t("$(database) Oracle: {0} | uncommitted", state.connectionName)
      : `$(database) Oracle: ${state.connectionName}`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
