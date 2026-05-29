import * as vscode from "vscode";
import {
  ObjectMetadataService,
  ORACLE_OBJECT_TYPES,
  OracleObjectType
} from "./objectMetadataService";
import { ConnectionTreeNode, createRootConnectionNodes } from "./connectionTreeModel";

export interface ConnectionTreeSource {
  listConnectionNames(): Promise<string[]>;
  listRecentSchemas?(connectionName: string): Promise<string[]>;
}

export class ConnectionTreeProvider implements vscode.TreeDataProvider<ConnectionTreeNode> {
  private readonly didChangeTreeData = new vscode.EventEmitter<ConnectionTreeNode | undefined>();
  readonly onDidChangeTreeData = this.didChangeTreeData.event;

  constructor(
    private readonly source: ConnectionTreeSource,
    private readonly metadata: ObjectMetadataService
  ) {}

  refresh(): void {
    this.didChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ConnectionTreeNode): vscode.TreeItem {
    switch (element.kind) {
      case "connection":
        {
          const item = new vscode.TreeItem(element.connectionName, vscode.TreeItemCollapsibleState.Collapsed);
          item.contextValue = "oracleWorkspace.connection";
          return item;
        }
      case "schemas":
        return new vscode.TreeItem(vscode.l10n.t("Schemas"), vscode.TreeItemCollapsibleState.Collapsed);
      case "schema":
        return new vscode.TreeItem(element.schema, vscode.TreeItemCollapsibleState.Collapsed);
      case "objectType":
        return new vscode.TreeItem(toGroupLabel(element.objectType), vscode.TreeItemCollapsibleState.Collapsed);
      case "object": {
          const item = new vscode.TreeItem(element.object.objectName, vscode.TreeItemCollapsibleState.None);
        item.description = element.object.status;
        item.contextValue = "oracleWorkspace.object";
        item.command = {
          command: "oracleWorkspace.openObjectDetails",
          title: vscode.l10n.t("Open Object Details"),
          arguments: [element.object, element.connectionName]
        };
        return item;
      }
      case "message":
        return new vscode.TreeItem(localizeMessage(element.message), vscode.TreeItemCollapsibleState.None);
    }
  }

  async getChildren(element?: ConnectionTreeNode): Promise<ConnectionTreeNode[]> {
    try {
      if (!element) {
        const connectionNames = await this.source.listConnectionNames();
        return createRootConnectionNodes(connectionNames);
      }

      switch (element.kind) {
        case "connection":
          return [{ kind: "schemas", connectionName: element.connectionName }];
        case "schemas": {
          const defaults = await this.metadata.listDefaultSchemas(element.connectionName);
          const recent = await this.source.listRecentSchemas?.(element.connectionName) ?? [];
          const schemas = [...new Set([...defaults, ...recent])];
          return schemas.length > 0
            ? schemas.map((schema) => ({ kind: "schema", connectionName: element.connectionName, schema }))
            : [{ kind: "message", message: "No schemas loaded" }];
        }
        case "schema":
          return ORACLE_OBJECT_TYPES.map((objectType) => ({
            kind: "objectType",
            connectionName: element.connectionName,
            schema: element.schema,
            objectType
          }));
        case "objectType": {
          const objects = await this.metadata.listObjects(
            element.connectionName,
            element.schema,
            element.objectType
          );
          return objects.length > 0
            ? objects.map((object) => ({ kind: "object", connectionName: element.connectionName, object }))
            : [{ kind: "message", message: noObjectsMessage(element.objectType) }];
        }
        default:
          return [];
      }
    } catch (error) {
      return [{ kind: "message", message: error instanceof Error ? error.message : "Failed to load node" }];
    }
  }
}

function toGroupLabel(type: OracleObjectType): string {
  switch (type) {
    case "TABLE":
      return vscode.l10n.t("Tables");
    case "VIEW":
      return vscode.l10n.t("Views");
    case "INDEX":
      return vscode.l10n.t("Indexes");
    case "SEQUENCE":
      return vscode.l10n.t("Sequences");
    case "SYNONYM":
      return vscode.l10n.t("Synonyms");
    case "PROCEDURE":
      return vscode.l10n.t("Procedures");
    case "FUNCTION":
      return vscode.l10n.t("Functions");
    case "PACKAGE":
      return vscode.l10n.t("Packages");
    case "PACKAGE BODY":
      return vscode.l10n.t("Package Bodies");
    case "TRIGGER":
      return vscode.l10n.t("Triggers");
  }
}

function noObjectsMessage(type: OracleObjectType): string {
  switch (type) {
    case "TABLE":
      return vscode.l10n.t("No tables");
    case "VIEW":
      return vscode.l10n.t("No views");
    case "INDEX":
      return vscode.l10n.t("No indexes");
    case "SEQUENCE":
      return vscode.l10n.t("No sequences");
    case "SYNONYM":
      return vscode.l10n.t("No synonyms");
    case "PROCEDURE":
      return vscode.l10n.t("No procedures");
    case "FUNCTION":
      return vscode.l10n.t("No functions");
    case "PACKAGE":
      return vscode.l10n.t("No packages");
    case "PACKAGE BODY":
      return vscode.l10n.t("No package bodies");
    case "TRIGGER":
      return vscode.l10n.t("No triggers");
  }
}

function localizeMessage(message: string): string {
  if (message === "No connections configured. Use + to add one.") {
    return vscode.l10n.t("No connections configured. Use + to add one.");
  }
  if (message === "No schemas loaded") {
    return vscode.l10n.t("No schemas loaded");
  }
  if (message === "Failed to load node") {
    return vscode.l10n.t("Failed to load node");
  }
  if (message.startsWith("No ")) {
    return vscode.l10n.t(message);
  }
  return message;
}
