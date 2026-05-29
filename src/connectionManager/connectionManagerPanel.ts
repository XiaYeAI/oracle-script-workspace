import { readFile } from "fs/promises";
import * as vscode from "vscode";
import { ConnectionConfigStore, OracleConnectionConfig } from "../config/connectionConfig";
import { SecretStore } from "../config/secretStore";
import { WorkspaceConfigStore } from "../config/workspaceConfig";
import { NodeOracleAdapter } from "../connections/oracleAdapter";
import { parseTnsnames } from "../connections/tnsnamesParser";
import { renderConnectionManagerHtml } from "./connectionManagerHtml";
import { ConnectionManagerMessage, ConnectionManagerState, TnsAliasView } from "./connectionManagerTypes";

export interface ConnectionManagerPanelOptions {
  connectionConfig: ConnectionConfigStore;
  workspaceConfig: WorkspaceConfigStore;
  secrets: SecretStore;
  adapter: NodeOracleAdapter;
  getActiveScriptFileName(): string | undefined;
  refreshViews(): void;
}

export class ConnectionManagerPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private state: ConnectionManagerState = {
    mode: "manage",
    connections: [],
    tnsnamesPaths: [],
    aliases: [],
    parseErrors: [],
    clientOptions: { name: "Default", mode: "thin" },
    clientProfiles: [{ name: "Default", mode: "thin" }]
  };

  constructor(private readonly options: ConnectionManagerPanelOptions) {}

  async show(mode: ConnectionManagerState["mode"] = "manage", selectedName?: string): Promise<void> {
    this.state = await this.createState(mode, selectedName);
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "oracleWorkspace.connectionManager",
        vscode.l10n.t("Connection Manager"),
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
      this.panel.webview.onDidReceiveMessage((message: ConnectionManagerMessage) => this.handleMessage(message));
    }

    this.render();
    this.panel.reveal(vscode.ViewColumn.Active);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async handleMessage(message: ConnectionManagerMessage): Promise<void> {
    switch (message.action) {
      case "newConnection":
        await this.show("add");
        return;
      case "editConnection":
        await this.show("edit", message.connectionName);
        return;
      case "duplicateConnection":
        await this.show("duplicate", message.connectionName);
        return;
      case "deleteConnection":
        await this.deleteConnection(message.connectionName);
        return;
      case "saveConnection":
        await this.saveConnection(message.connection, message.originalName, message.password, message.rememberPassword);
        return;
      case "saveTnsLogin":
        await this.saveTnsLogin(message.connection, message.password, message.rememberPassword, message.setCurrentScript);
        return;
      case "testTnsLogin":
        await this.testConnection(message.connection, message.password);
        return;
      case "testConnection":
        await this.testConnection(message.connection, message.password);
        return;
      case "saveClientOptions":
        await this.saveClientOptions(message.options);
        return;
      case "saveClientProfiles":
        await this.saveClientProfiles(message.profiles);
        return;
      case "pickOracleClientLibraryDir":
        await this.pickOracleClientDirectory("libraryDir");
        return;
      case "pickOracleClientConfigDir":
        await this.pickOracleClientDirectory("configDir");
        return;
      case "addTnsPath":
        await this.addTnsPath();
        return;
      case "removeTnsPath":
        await this.removeTnsPath(message.path);
        return;
      case "reloadAliases":
        await this.show(this.state.mode, this.state.selectedName);
        return;
      case "setCurrentScriptConnection":
        await this.setCurrentScriptConnection(message.connectionName);
        return;
      case "cancel":
        this.panel?.dispose();
        return;
    }
  }

  private async saveTnsLogin(
    connection: OracleConnectionConfig,
    password: string | undefined,
    rememberPassword: boolean,
    setCurrentScript: boolean | undefined
  ): Promise<void> {
    await this.saveConnection(connection, undefined, password, rememberPassword);
    if (setCurrentScript) {
      await this.setCurrentScriptConnection(connection.name);
    }
  }

  private async saveConnection(
    connection: OracleConnectionConfig,
    originalName: string | undefined,
    password: string | undefined,
    rememberPassword: boolean
  ): Promise<void> {
    if (originalName && originalName !== connection.name) {
      await this.options.connectionConfig.deleteConnection(originalName);
      await this.options.workspaceConfig.renameScriptConnection(originalName, connection.name);
    }
    await this.options.connectionConfig.addOrUpdateConnection(connection);
    if (password && rememberPassword) {
      await this.options.secrets.savePassword(connection.name, connection.username, password);
    }
    this.options.refreshViews();
    await this.show("edit", connection.name);
    this.postStatus(vscode.l10n.t("Oracle connection '{0}' saved.", connection.name), "ok");
  }

  private async deleteConnection(connectionName: string): Promise<void> {
    const connection = this.options.connectionConfig.getConnection(connectionName);
    if (!connection) {
      return;
    }
    const confirm = await vscode.window.showWarningMessage(
      vscode.l10n.t("Delete Oracle connection '{0}'?", connectionName),
      { modal: true },
      vscode.l10n.t("Delete")
    );
    if (confirm !== vscode.l10n.t("Delete")) {
      return;
    }
    await this.options.secrets.deletePassword(connection.name, connection.username);
    await this.options.connectionConfig.deleteConnection(connection.name);
    this.options.refreshViews();
    await this.show("manage");
  }

  private async testConnection(connection: OracleConnectionConfig, password: string | undefined): Promise<void> {
    const saved = await this.options.secrets.getPassword(connection.name, connection.username);
    const effectivePassword = password || saved;
    if (!effectivePassword) {
      this.postStatus(vscode.l10n.t("Password for connection '{0}' was not provided.", connection.name), "error");
      return;
    }
    try {
      const handle = await this.options.adapter.connect(connection, effectivePassword);
      await handle.close();
      this.postStatus(vscode.l10n.t("Oracle connection '{0}' succeeded.", connection.name), "ok");
    } catch (error) {
      this.postStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  private async addTnsPath(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { "tnsnames.ora": ["ora"], All: ["*"] }
    });
    const selectedPath = picked?.[0]?.fsPath;
    if (!selectedPath) {
      return;
    }
    await this.options.connectionConfig.updateTnsnamesPaths([
      ...this.options.connectionConfig.listTnsnamesPaths(),
      selectedPath
    ]);
    await this.show(this.state.mode, this.state.selectedName);
  }

  private async pickOracleClientDirectory(field: "libraryDir" | "configDir"): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false
    });
    const selectedPath = picked?.[0]?.fsPath;
    if (!selectedPath) {
      return;
    }
    this.panel?.webview.postMessage({ action: "pickedOracleClientDirectory", field, path: selectedPath });
  }

  private async saveClientOptions(options: ConnectionManagerState["clientOptions"]): Promise<void> {
    await this.options.connectionConfig.updateOracleClientOptions(options);
    this.state = await this.createState(this.state.mode, this.state.selectedName);
    this.render();
    this.postStatus(vscode.l10n.t("Oracle Client settings saved. Reload VS Code before testing changed client mode."), "ok");
  }

  private async saveClientProfiles(profiles: ConnectionManagerState["clientProfiles"]): Promise<void> {
    await this.options.connectionConfig.updateOracleClientProfiles(profiles);
    this.state = await this.createState(this.state.mode, this.state.selectedName);
    this.render();
    this.postStatus(vscode.l10n.t("Oracle Client profiles saved. Reload VS Code before switching between different profiles."), "ok");
  }

  private async removeTnsPath(tnsPath: string): Promise<void> {
    await this.options.connectionConfig.updateTnsnamesPaths(
      this.options.connectionConfig.listTnsnamesPaths().filter((item) => item !== tnsPath)
    );
    await this.show(this.state.mode, this.state.selectedName);
  }

  private async setCurrentScriptConnection(connectionName: string): Promise<void> {
    const activeFile = this.options.getActiveScriptFileName();
    if (!activeFile) {
      this.postStatus(vscode.l10n.t("Open a SQL file before binding a connection."), "error");
      return;
    }
    await this.options.workspaceConfig.setConnectionForScript(activeFile, connectionName);
    this.options.refreshViews();
    this.postStatus(vscode.l10n.t("Current script bound to '{0}'.", connectionName), "ok");
  }

  private async createState(mode: ConnectionManagerState["mode"], selectedName?: string): Promise<ConnectionManagerState> {
    const aliases: TnsAliasView[] = [];
    const parseErrors: Array<{ sourcePath: string; message: string }> = [];
    for (const tnsPath of this.options.connectionConfig.listTnsnamesPaths()) {
      try {
        const parsed = parseTnsnames(await readFile(tnsPath, "utf8"), tnsPath);
        aliases.push(...parsed.aliases.map((alias) => ({ alias: alias.alias, sourcePath: alias.sourcePath })));
        parseErrors.push(...parsed.errors);
      } catch (error) {
        parseErrors.push({ sourcePath: tnsPath, message: error instanceof Error ? error.message : String(error) });
      }
    }

    const connections = this.options.connectionConfig.listConfiguredConnections();
    const duplicateSource = mode === "duplicate" && selectedName
      ? connections.find((connection) => connection.name === selectedName)
      : undefined;
    const selected = duplicateSource ? `${duplicateSource.name}_COPY` : selectedName;
    const nextConnections = duplicateSource
      ? [...connections, { ...duplicateSource, name: `${duplicateSource.name}_COPY` } as OracleConnectionConfig]
      : connections;

    return {
      mode,
      selectedName: selected,
      connections: nextConnections,
      tnsnamesPaths: this.options.connectionConfig.listTnsnamesPaths(),
      aliases,
      parseErrors,
      clientOptions: this.options.connectionConfig.getOracleClientOptions(),
      clientProfiles: this.options.connectionConfig.listOracleClientProfiles()
    };
  }

  private render(): void {
    if (!this.panel) {
      return;
    }
    this.panel.webview.html = renderConnectionManagerHtml(this.state, createLabels());
  }

  private postStatus(message: string, kind: "ok" | "error"): void {
    this.panel?.webview.postMessage({ action: "status", message, kind });
  }
}

function createLabels() {
  return {
    title: vscode.l10n.t("Connection Manager"),
    connections: vscode.l10n.t("Connections"),
    add: vscode.l10n.t("Add"),
    edit: vscode.l10n.t("Edit"),
    duplicate: vscode.l10n.t("Duplicate"),
    delete: vscode.l10n.t("Delete"),
    test: vscode.l10n.t("Test Connection"),
    setCurrent: vscode.l10n.t("Set Current"),
    connectionsTab: vscode.l10n.t("Connections"),
    tnsNamesTab: vscode.l10n.t("TNS Names"),
    oracleClientTab: vscode.l10n.t("Oracle Client"),
    savedConnections: vscode.l10n.t("Saved Connections"),
    customOracle: vscode.l10n.t("Custom Oracle"),
    tnsAlias: vscode.l10n.t("TNS Alias"),
    connectionName: vscode.l10n.t("Connection Name"),
    username: vscode.l10n.t("Username"),
    password: vscode.l10n.t("Password"),
    rememberPassword: vscode.l10n.t("Remember password"),
    note: vscode.l10n.t("Note"),
    host: vscode.l10n.t("Host"),
    port: vscode.l10n.t("Port"),
    connectionIdentifier: vscode.l10n.t("Connection Identifier"),
    serviceName: vscode.l10n.t("Service Name"),
    sid: vscode.l10n.t("SID"),
    save: vscode.l10n.t("Save"),
    cancel: vscode.l10n.t("Cancel"),
    tnsPaths: vscode.l10n.t("tnsnames.ora paths"),
    addPath: vscode.l10n.t("Add Path"),
    reloadAliases: vscode.l10n.t("Reload Aliases"),
    aliases: vscode.l10n.t("Aliases"),
    parseErrors: vscode.l10n.t("Parse Errors"),
    sourceFile: vscode.l10n.t("Source file"),
    validationNameRequired: vscode.l10n.t("Connection name is required."),
    validationUsernameRequired: vscode.l10n.t("Username is required."),
    validationHostRequired: vscode.l10n.t("Host is required."),
    validationPortRequired: vscode.l10n.t("Port must be a positive integer."),
    validationServiceOrSidRequired: vscode.l10n.t("Service Name or SID is required."),
    validationServiceNameRequired: vscode.l10n.t("Service Name is required."),
    validationSidRequired: vscode.l10n.t("SID is required."),
    validationAliasRequired: vscode.l10n.t("TNS alias is required."),
    validationDuplicateName: vscode.l10n.t("Connection name already exists."),
    tnsLoginTitle: vscode.l10n.t("TNS Alias Login"),
    alias: vscode.l10n.t("Alias"),
    testLogin: vscode.l10n.t("Test Login"),
    saveLogin: vscode.l10n.t("Save Login"),
    saveAndSetCurrent: vscode.l10n.t("Save and Set Current Script"),
    loginNamePreview: vscode.l10n.t("Saved connection name"),
    clientProfile: vscode.l10n.t("Client profile"),
    clientProfiles: vscode.l10n.t("Client profiles"),
    profileName: vscode.l10n.t("Profile name"),
    clientMode: vscode.l10n.t("Client mode"),
    thinMode: vscode.l10n.t("Thin"),
    thickMode: vscode.l10n.t("Thick"),
    oracleClientLibraryDir: vscode.l10n.t("Oracle Client / Instant Client directory"),
    oracleClientConfigDir: vscode.l10n.t("Oracle Net configuration directory"),
    browse: vscode.l10n.t("Browse"),
    saveClient: vscode.l10n.t("Save Oracle Client Settings"),
    reloadRequired: vscode.l10n.t("Reload VS Code after changing Oracle Client mode or directories."),
    clientSettingsSaved: vscode.l10n.t("Oracle Client settings saved. Reload VS Code before testing changed client mode."),
    saveClientProfiles: vscode.l10n.t("Save Oracle Client Profiles"),
    clientProfilesSaved: vscode.l10n.t("Oracle Client profiles saved. Reload VS Code before switching between different profiles."),
    optional: vscode.l10n.t("optional")
  };
}
