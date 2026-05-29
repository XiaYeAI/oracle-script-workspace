import * as vscode from "vscode";
import { registerCommands } from "./commands/commandRegistry";
import { OracleCommandWorkflow, OracleWorkflowWindow } from "./commands/oracleCommandWorkflow";
import * as path from "path";
import { ConnectionManagerPanel } from "./connectionManager/connectionManagerPanel";
import { ConnectionConfigStore } from "./config/connectionConfig";
import { SecretStore } from "./config/secretStore";
import { WorkspaceConfigStore } from "./config/workspaceConfig";
import { NodeOracleAdapter } from "./connections/oracleAdapter";
import { OracleSessionManager } from "./connections/oracleSessionManager";
import { LicensePanel } from "./license/licensePanel";
import { LicenseService } from "./license/licenseService";
import { ObjectDetailsPanel, ObjectDetailsTab } from "./objectDetails/objectDetailsPanel";
import { OracleObjectDetailsService } from "./objectDetails/objectDetailsService";
import { ResultPanel } from "./results/resultPanel";
import { ConnectionTreeProvider } from "./tree/connectionTreeProvider";
import { OracleObjectMetadataService, OracleSchemaObject } from "./tree/objectMetadataService";
import { KeymapProfileService } from "./ui/keymapProfile";
import { StatusBarController } from "./ui/statusBar";
import { TransactionGuard } from "./ui/transactionGuard";
import { CurrentScriptProvider } from "./workbench/currentScriptProvider";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const keymapProfile = new KeymapProfileService(vscode, t);
  await keymapProfile.apply(keymapProfile.getCurrentProfile());

  const statusBar = new StatusBarController();
  context.subscriptions.push(statusBar);

  const configurationTarget = vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  const connectionConfig = new ConnectionConfigStore(vscode.workspace, configurationTarget);
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.globalStorageUri.fsPath;
  const workspaceConfig = new WorkspaceConfigStore(workspaceRoot);
  const secrets = new SecretStore(context.secrets);
  const sessionManager = new OracleSessionManager(
    createOracleAdapter(connectionConfig),
    {
      async getConnection(connectionName: string) {
        return connectionConfig.getConnection(connectionName);
      }
    },
    secrets,
    connectionConfig.getMaxRows()
  );
  const resultPanel = new ResultPanel(context.extensionUri);
  context.subscriptions.push(
    resultPanel,
    vscode.window.registerWebviewViewProvider("oracleWorkspace.results", resultPanel)
  );
  const licenseService = new LicenseService(context.globalState);
  const licensePanel = new LicensePanel(licenseService);
  context.subscriptions.push(licensePanel);
  const transactionGuard = new TransactionGuard(sessionManager);

  const workflow = new OracleCommandWorkflow({
    workspaceConfig,
    connectionStore: connectionConfig,
    secrets,
    session: sessionManager,
    resultPanel,
    statusBar,
    window: createWorkflowWindow(),
    beforeSwitchConnection: (connectionName) => transactionGuard.confirmBeforeLeavingDirtyConnection(connectionName)
  });
  const passwordPrompt = {
    async ensurePassword(connectionName: string) {
      const connection = connectionConfig.getConnection(connectionName);
      if (!connection) {
        throw new Error(t("Connection '{0}' is not configured.", connectionName));
      }

      const existing = await secrets.getPassword(connectionName, connection.username);
      if (existing) {
        return;
      }

      const password = await vscode.window.showInputBox({
        prompt: t("Password for {0}@{1}", connection.username, connectionName),
        password: true,
        ignoreFocusOut: true
      });
      if (!password) {
        throw new Error(t("Password for connection '{0}' was not provided.", connectionName));
      }

      await secrets.savePassword(connectionName, connection.username, password);
    }
  };
  const metadata = new OracleObjectMetadataService(sessionManager, passwordPrompt);
  const objectDetails = new OracleObjectDetailsService(sessionManager, passwordPrompt);
  const objectDetailsPanel = new ObjectDetailsPanel(async (request) =>
    (await objectDetails.getDetails(request)).map(localizeObjectDetailsTab)
  );
  context.subscriptions.push(objectDetailsPanel);

  const connectionTree = new ConnectionTreeProvider(
    {
      async listConnectionNames() {
        return connectionConfig.listConfiguredConnections().map((connection) => connection.name);
      },
      async listRecentSchemas(connectionName: string) {
        return workspaceConfig.listRecentSchemas(connectionName);
      }
    },
    metadata
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("oracleWorkspace.connections", connectionTree)
  );
  const currentScriptProvider = new CurrentScriptProvider({
    connectionConfig,
    workspaceConfig,
    sessionManager
  });
  context.subscriptions.push(
    currentScriptProvider,
    vscode.window.registerWebviewViewProvider("oracleWorkspace.currentScript", currentScriptProvider)
  );
  const connectionManager = new ConnectionManagerPanel({
    connectionConfig,
    workspaceConfig,
    secrets,
    adapter: createOracleAdapter(connectionConfig),
    getActiveScriptFileName: () => vscode.window.activeTextEditor?.document.fileName,
    refreshViews: () => {
      connectionTree.refresh();
      void currentScriptProvider.refresh();
    }
  });
  context.subscriptions.push(connectionManager);

  registerCommands(context, {
    keymapProfile,
    statusBar,
    workflow,
    addConnection: () => connectionManager.show("add"),
    addCustomConnection: async () => {
      await connectionManager.show("add");
    },
    addTnsConnection: async () => {
      await connectionManager.show("add");
    },
    manageConnections: () => connectionManager.show("manage"),
    editConnection: async (connectionName?: string) => {
      const name = connectionName ?? (await pickConnectionName(connectionConfig, t("Select connection to edit")));
      if (!name) {
        return;
      }
      await connectionManager.show("edit", name);
    },
    duplicateConnection: async (connectionName?: string) => {
      const name = connectionName ?? (await pickConnectionName(connectionConfig, t("Select connection to duplicate")));
      if (name) {
        await connectionManager.show("duplicate", name);
      }
    },
    deleteConnection: async (connectionName?: string) => {
      const name = connectionName ?? (await pickConnectionName(connectionConfig, t("Select connection to delete")));
      if (!name) {
        return;
      }

      const existing = connectionConfig.getConnection(name);
      if (!existing) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        t("Delete Oracle connection '{0}'? Saved password for {1} will also be removed.", name, existing.username),
        { modal: true },
        t("Delete")
      );
      if (confirm !== t("Delete")) {
        return;
      }

      await sessionManager.close(name);
      await secrets.deletePassword(name, existing.username);
      await connectionConfig.deleteConnection(name);
      connectionTree.refresh();
      await currentScriptProvider.refresh();
      await vscode.window.showInformationMessage(t("Oracle connection '{0}' deleted.", name));
    },
    testConnection: async (connectionName?: string) => {
      const name = connectionName ?? (await pickConnectionName(connectionConfig, t("Select connection to test")));
      if (!name) {
        return;
      }

      const connection = connectionConfig.getConnection(name);
      if (!connection) {
        await vscode.window.showErrorMessage(t("Connection '{0}' is not configured.", name));
        return;
      }

      let password = await secrets.getPassword(name, connection.username);
      if (!password) {
        password = await vscode.window.showInputBox({
          prompt: t("Password for {0}@{1}", connection.username, name),
          password: true,
          ignoreFocusOut: true
        });
        if (!password) {
          return;
        }
        await secrets.savePassword(name, connection.username, password);
      }

      const handle = await createOracleAdapter(connectionConfig).connect(connection, password);
      await handle.close();
      await vscode.window.showInformationMessage(t("Oracle connection '{0}' succeeded.", name));
    },
    manageLicense: () => licensePanel.show(),
    openObjectDetails: async (object?: OracleSchemaObject, connectionName?: string) => {
      const request = object && connectionName
        ? {
            connectionName,
            owner: object.owner,
            objectName: object.objectName,
            objectType: object.objectType
          }
        : await resolveObjectDetailsRequest(workspaceConfig, connectionConfig, metadata);
      if (!request) {
        return;
      }

      const tabs = (await objectDetails.getDetails(request)).map(localizeObjectDetailsTab);
      objectDetailsPanel.show(request, tabs);
    },
    refreshConnectionTree: () => {
      connectionTree.refresh();
      void currentScriptProvider.refresh();
    },
    setCurrentScriptConnection: async (connectionName?: string) => {
      const name = connectionName ?? (await pickConnectionName(connectionConfig, t("Select connection for this SQL file")));
      const activeFile = vscode.window.activeTextEditor?.document.fileName;
      if (!name || !activeFile) {
        return;
      }
      const current = await workspaceConfig.getConnectionForScript(path.basename(activeFile));
      const decision = await transactionGuard.confirmBeforeLeavingDirtyConnection(current);
      if (decision === "cancel") {
        return;
      }
      await workspaceConfig.setConnectionForScript(path.basename(activeFile), name);
      statusBar.update({ connectionName: name, hasUncommittedChanges: sessionManager.hasUncommittedChanges(name) });
      await currentScriptProvider.refresh();
    },
    searchSchema: async (connectionName?: string) => {
      const name = connectionName ?? (await pickConnectionName(connectionConfig, t("Select connection for schema search")));
      if (!name) {
        return;
      }
      await passwordPrompt.ensurePassword(name);
      const keyword = await vscode.window.showInputBox({
        prompt: t("Schema keyword"),
        ignoreFocusOut: true
      });
      if (!keyword) {
        return;
      }
      const schemas = await metadata.searchSchemas(name, keyword);
      const schema = await vscode.window.showQuickPick(schemas, {
        placeHolder: t("Select schema to load"),
        ignoreFocusOut: true
      });
      if (!schema) {
        return;
      }
      await workspaceConfig.addRecentSchema(name, schema);
      connectionTree.refresh();
    }
  });
}

async function resolveObjectDetailsRequest(
  workspaceConfig: WorkspaceConfigStore,
  connectionConfig: ConnectionConfigStore,
  metadata: OracleObjectMetadataService
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await vscode.window.showErrorMessage(t("Open a SQL file or select an object from the tree first."));
    return undefined;
  }

  const token = getSelectedOrCurrentObjectToken(editor);
  if (!token) {
    await vscode.window.showErrorMessage(t("Select an Oracle object name or place the cursor on one."));
    return undefined;
  }

  const connectionName =
    (await workspaceConfig.getConnectionForScript(path.basename(editor.document.fileName))) ??
    (await pickConnectionName(connectionConfig, t("Select connection for object lookup")));
  if (!connectionName) {
    return undefined;
  }

  const [owner, objectName] = token.includes(".")
    ? token.split(".", 2)
    : [undefined, token];
  const matches = await metadata.findObjects(connectionName, objectName, owner);
  if (matches.length === 0) {
    await vscode.window.showErrorMessage(t("Object '{0}' was not found for connection '{1}'.", token, connectionName));
    return undefined;
  }

  const selected = matches.length === 1
    ? matches[0]
    : await pickObjectMatch(matches);
  if (!selected) {
    return undefined;
  }

  return {
    connectionName,
    owner: selected.owner,
    objectName: selected.objectName,
    objectType: selected.objectType
  };
}

function getSelectedOrCurrentObjectToken(editor: vscode.TextEditor): string | undefined {
  const selectedText = editor.document.getText(editor.selection).trim();
  if (selectedText) {
    return selectedText.replace(/[";]/g, "");
  }

  const range = editor.document.getWordRangeAtPosition(
    editor.selection.active,
    /[A-Za-z][A-Za-z0-9_$#]*(\.[A-Za-z][A-Za-z0-9_$#]*)?/
  );
  if (!range) {
    return undefined;
  }

  return editor.document.getText(range);
}

async function pickObjectMatch(matches: OracleSchemaObject[]): Promise<OracleSchemaObject | undefined> {
  const selected = await vscode.window.showQuickPick(
    matches.map((match) => ({
      label: `${match.owner}.${match.objectName}`,
      description: match.objectType,
      match
    })),
    { placeHolder: t("Select Oracle object"), ignoreFocusOut: true }
  );

  return selected?.match;
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions automatically.
}

function localizeObjectDetailsTab(tab: ObjectDetailsTab): ObjectDetailsTab {
  return { ...tab, title: localizeObjectDetailsTitle(tab.title) };
}

function localizeObjectDetailsTitle(title: string): string {
  switch (title) {
    case "Columns":
      return t("Columns");
    case "Preview":
      return t("Preview");
    case "DDL":
      return t("DDL");
    case "Indexes":
      return t("Indexes");
    case "Constraints":
      return t("Constraints");
    case "View SQL":
      return t("View SQL");
    case "Source":
      return t("Source");
    case "Arguments":
      return t("Arguments");
    case "Compile Errors":
      return t("Compile Errors");
    case "Spec":
      return t("Spec");
    case "Body":
      return t("Body");
    case "Procedures/Functions":
      return t("Procedures/Functions");
    case "Table":
      return t("Table");
    default:
      return title;
  }
}

function t(message: string, ...args: Array<string | number | boolean>): string {
  return vscode.l10n.t(message, ...args);
}

async function pickConnectionName(
  connectionConfig: ConnectionConfigStore,
  placeHolder: string
): Promise<string | undefined> {
  const names = connectionConfig.listConfiguredConnections().map((connection) => connection.name);
  if (names.length === 0) {
    await vscode.window.showErrorMessage(t("No Oracle connections are configured."));
    return undefined;
  }
  return vscode.window.showQuickPick(names, { placeHolder, ignoreFocusOut: true });
}

function createWorkflowWindow(): OracleWorkflowWindow {
  return {
    async pickConnection(connectionNames: string[]) {
      return vscode.window.showQuickPick(connectionNames, {
        placeHolder: t("Select Oracle connection for this SQL file")
      });
    },
    async inputPassword(connectionName: string, username: string) {
      return vscode.window.showInputBox({
        prompt: t("Password for {0}@{1}", username, connectionName),
        password: true,
        ignoreFocusOut: true
      });
    },
    async confirmRunScript(statementCount: number) {
      const run = t("Run");
      const answer = await vscode.window.showWarningMessage(
        t("Run the whole script with {0} statements?", statementCount),
        { modal: true },
        run
      );
      return answer === run;
    },
    async showInformationMessage(message: string) {
      await vscode.window.showInformationMessage(message);
    },
    async showErrorMessage(message: string) {
      await vscode.window.showErrorMessage(message);
    }
  };
}

function createOracleAdapter(connectionConfig: ConnectionConfigStore): NodeOracleAdapter {
  return new NodeOracleAdapter((connection) => connectionConfig.getOracleClientOptionsForConnection(connection));
}
