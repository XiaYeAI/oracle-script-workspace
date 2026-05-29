import * as vscode from "vscode";
import { OracleSessionManager } from "../connections/oracleSessionManager";

export class TransactionGuard {
  constructor(private readonly sessionManager: OracleSessionManager) {}

  async confirmBeforeLeavingDirtyConnection(connectionName: string | undefined): Promise<"continue" | "cancel"> {
    if (!connectionName || !this.sessionManager.hasUncommittedChanges(connectionName)) {
      return "continue";
    }

    const commit = vscode.l10n.t("Commit");
    const rollback = vscode.l10n.t("Rollback");
    const cancel = vscode.l10n.t("Cancel");
    const picked = await vscode.window.showWarningMessage(
      vscode.l10n.t("Connection {0} has uncommitted changes.", connectionName),
      { modal: true },
      commit,
      rollback,
      cancel
    );

    if (picked === commit) {
      await this.sessionManager.commit(connectionName);
      return "continue";
    }
    if (picked === rollback) {
      await this.sessionManager.rollback(connectionName);
      return "continue";
    }
    return "cancel";
  }
}
