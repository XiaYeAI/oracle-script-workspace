import { OracleObjectType, OracleSchemaObject } from "./objectMetadataService";

export type ConnectionTreeNode =
  | { kind: "connection"; connectionName: string }
  | { kind: "schemas"; connectionName: string }
  | { kind: "schema"; connectionName: string; schema: string }
  | { kind: "objectType"; connectionName: string; schema: string; objectType: OracleObjectType }
  | { kind: "object"; connectionName: string; object: OracleSchemaObject }
  | { kind: "message"; message: string };

export function createRootConnectionNodes(connectionNames: string[]): ConnectionTreeNode[] {
  return connectionNames.length > 0
    ? connectionNames.map((connectionName) => ({ kind: "connection", connectionName }))
    : [{ kind: "message", message: "No connections configured. Use + to add one." }];
}
