import { OracleClientOptions, OracleClientProfile, OracleConnectionConfig, TnsOracleConnection } from "../config/connectionConfig";

export interface TnsAliasView {
  alias: string;
  sourcePath: string;
}

export interface ConnectionManagerState {
  mode: "manage" | "add" | "edit" | "duplicate";
  selectedName?: string;
  connections: OracleConnectionConfig[];
  tnsnamesPaths: string[];
  aliases: TnsAliasView[];
  parseErrors: Array<{ sourcePath: string; message: string }>;
  clientOptions: OracleClientOptions;
  clientProfiles: OracleClientProfile[];
}

export type ConnectionManagerMessage =
  | { action: "ready" }
  | { action: "saveConnection"; connection: OracleConnectionConfig; originalName?: string; password?: string; rememberPassword: boolean }
  | { action: "saveTnsLogin"; connection: TnsOracleConnection; password?: string; rememberPassword: boolean; setCurrentScript?: boolean }
  | { action: "testTnsLogin"; connection: TnsOracleConnection; password?: string }
  | { action: "deleteConnection"; connectionName: string }
  | { action: "duplicateConnection"; connectionName: string }
  | { action: "editConnection"; connectionName: string }
  | { action: "newConnection" }
  | { action: "testConnection"; connection: OracleConnectionConfig; password?: string }
  | { action: "saveClientOptions"; options: OracleClientOptions }
  | { action: "saveClientProfiles"; profiles: OracleClientProfile[] }
  | { action: "pickOracleClientLibraryDir" }
  | { action: "pickOracleClientConfigDir" }
  | { action: "addTnsPath" }
  | { action: "removeTnsPath"; path: string }
  | { action: "reloadAliases" }
  | { action: "setCurrentScriptConnection"; connectionName: string }
  | { action: "cancel" };
