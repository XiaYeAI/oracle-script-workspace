import * as vscode from "vscode";
import { OracleObjectType } from "../tree/objectMetadataService";
import { renderObjectDetailsHtml } from "./objectDetailsHtml";

export interface ObjectDetailsRequest {
  connectionName: string;
  owner: string;
  objectName: string;
  objectType?: OracleObjectType;
}

export interface ObjectDetailsTab {
  title: string;
  kind: "table" | "code" | "text";
  content: unknown;
}

export type ObjectDetailsRefresher = (request: ObjectDetailsRequest) => Promise<ObjectDetailsTab[]>;

export class ObjectDetailsPanel {
  private panel: vscode.WebviewPanel | undefined;
  private request: ObjectDetailsRequest | undefined;
  private tabs: ObjectDetailsTab[] = [];

  constructor(private readonly refreshDetails?: ObjectDetailsRefresher) {}

  show(request: ObjectDetailsRequest, tabs: ObjectDetailsTab[]): void {
    this.request = request;
    this.tabs = tabs;
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "oracleWorkspace.objectDetails",
        vscode.l10n.t("Oracle Object Details"),
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
      this.panel.webview.onDidReceiveMessage((message: { action?: string; index?: number }) => this.handleMessage(message));
    }

    this.panel.title = `${request.owner}.${request.objectName}`;
    this.panel.webview.html = renderObjectDetailsHtml(request, tabs, {
      noRows: vscode.l10n.t("No rows"),
      refresh: vscode.l10n.t("Refresh"),
      copy: vscode.l10n.t("Copy"),
      openAsSql: vscode.l10n.t("Open as SQL"),
      type: vscode.l10n.t("Type"),
      connection: vscode.l10n.t("Connection")
    });
    this.panel.reveal(vscode.ViewColumn.Active);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async handleMessage(message: { action?: string; index?: number }): Promise<void> {
    if (message.action === "refresh") {
      if (!this.request || !this.refreshDetails) {
        return;
      }
      try {
        this.show(this.request, await this.refreshDetails(this.request));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(message);
      }
      return;
    }
    const tab = typeof message.index === "number" ? this.tabs[message.index] : undefined;
    if (!tab || tab.kind !== "code") {
      return;
    }
    const text = String(tab.content ?? "");
    if (message.action === "copy") {
      await vscode.env.clipboard.writeText(text);
      return;
    }
    if (message.action === "openAsSql") {
      const document = await vscode.workspace.openTextDocument({ language: "sql", content: text });
      await vscode.window.showTextDocument(document, vscode.ViewColumn.Active);
    }
  }
}
