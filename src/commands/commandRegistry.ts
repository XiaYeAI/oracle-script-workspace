import * as vscode from "vscode";
import {
  OracleCommandWorkflow,
  OracleWorkflowDocument
} from "./oracleCommandWorkflow";
import { KeymapProfileService } from "../ui/keymapProfile";
import { StatusBarController } from "../ui/statusBar";
import { OracleSchemaObject } from "../tree/objectMetadataService";

interface CommandRegistryServices {
  keymapProfile: KeymapProfileService;
  statusBar: StatusBarController;
  workflow?: OracleCommandWorkflow;
  addConnection?: () => Promise<void>;
  addCustomConnection?: () => Promise<void>;
  addTnsConnection?: () => Promise<void>;
  manageConnections?: () => Promise<void>;
  editConnection?: (connectionName?: string) => Promise<void>;
  duplicateConnection?: (connectionName?: string) => Promise<void>;
  deleteConnection?: (connectionName?: string) => Promise<void>;
  testConnection?: (connectionName?: string) => Promise<void>;
  manageLicense?: () => Promise<void>;
  openObjectDetails?: (object?: OracleSchemaObject, connectionName?: string) => Promise<void>;
  searchSchema?: (connectionName?: string) => Promise<void>;
  setCurrentScriptConnection?: (connectionName?: string) => Promise<void>;
  refreshConnectionTree?: () => void;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  services: CommandRegistryServices
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("oracleWorkspace.runCurrentOrSelected", async () =>
      runWithActiveDocument(services, (workflow, document) => workflow.runCurrentOrSelected(document))
    ),
    vscode.commands.registerCommand("oracleWorkspace.runScript", async () =>
      runWithActiveDocument(services, (workflow, document) => workflow.runScript(document))
    ),
    vscode.commands.registerCommand("oracleWorkspace.explainPlan", async () =>
      runWithActiveDocument(services, (workflow, document) => workflow.explainPlan(document))
    ),
    vscode.commands.registerCommand("oracleWorkspace.switchConnection", async () =>
      runWithActiveDocument(services, (workflow, document) => workflow.switchConnection(document))
    ),
    vscode.commands.registerCommand("oracleWorkspace.commit", async () =>
      runWithActiveDocument(services, (workflow, document) => workflow.commit(document))
    ),
    vscode.commands.registerCommand("oracleWorkspace.rollback", async () =>
      runWithActiveDocument(services, (workflow, document) => workflow.rollback(document))
    ),
    vscode.commands.registerCommand("oracleWorkspace.openObjectDetails", async (
      object?: OracleSchemaObject,
      connectionName?: string
    ) => {
      try {
        await services.openObjectDetails?.(object, connectionName);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.addConnection", async () => {
      try {
        await services.addConnection?.();
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.addCustomConnection", async () => {
      try {
        await services.addCustomConnection?.();
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.addTnsConnection", async () => {
      try {
        await services.addTnsConnection?.();
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.manageConnections", async () => {
      try {
        await services.manageConnections?.();
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.editConnection", async (node?: { connectionName?: string }) => {
      try {
        await services.editConnection?.(node?.connectionName);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.duplicateConnection", async (node?: { connectionName?: string }) => {
      try {
        await services.duplicateConnection?.(node?.connectionName);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.deleteConnection", async (node?: { connectionName?: string }) => {
      try {
        await services.deleteConnection?.(node?.connectionName);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.testConnection", async (node?: { connectionName?: string }) => {
      try {
        await services.testConnection?.(node?.connectionName);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.manageLicense", async () => {
      try {
        await services.manageLicense?.();
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.searchSchema", async (node?: { connectionName?: string }) => {
      try {
        await services.searchSchema?.(node?.connectionName);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand("oracleWorkspace.setCurrentScriptConnection", async (node?: { connectionName?: string }) => {
      try {
        await services.setCurrentScriptConnection?.(node?.connectionName);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("oracleWorkspace.switchKeymapProfile", async () => {
      const profile = await services.keymapProfile.switchProfile();
      if (profile) {
        await vscode.window.showInformationMessage(vscode.l10n.t("Oracle Script Workspace keymap: {0}", profile));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("oracleWorkspace.refreshConnectionTree", async () => {
      services.refreshConnectionTree?.();
      await vscode.window.showInformationMessage(vscode.l10n.t("Oracle Script Workspace connection tree refreshed."));
    })
  );
}

async function runWithActiveDocument(
  services: CommandRegistryServices,
  run: (workflow: OracleCommandWorkflow, document: OracleWorkflowDocument) => Promise<unknown>
): Promise<void> {
  if (!services.workflow) {
    await vscode.window.showErrorMessage(vscode.l10n.t("Oracle Script Workspace workflow is not initialized."));
    return;
  }

  const document = getActiveWorkflowDocument();
  if (!document) {
    await vscode.window.showErrorMessage(vscode.l10n.t("Open a SQL file before running Oracle Script Workspace commands."));
    return;
  }

  try {
    await run(services.workflow, document);
  } catch (error) {
    await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}

function getActiveWorkflowDocument(): OracleWorkflowDocument | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const { document, selection } = editor;
  return {
    fileName: document.fileName,
    text: document.getText(),
    selectionStart: document.offsetAt(selection.start),
    selectionEnd: document.offsetAt(selection.end)
  };
}
