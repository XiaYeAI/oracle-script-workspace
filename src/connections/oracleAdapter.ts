import oracledb = require("oracledb");
import { OracleClientOptions, OracleConnectionConfig } from "../config/connectionConfig";

export interface OracleExecuteOptions {
  maxRows: number;
}

export interface OracleQueryResult {
  type: "query";
  columns: string[];
  rows: unknown[][];
  hasMoreRows: boolean;
  elapsedMs: number;
}

export interface OracleUpdateResult {
  type: "update";
  rowsAffected: number;
  elapsedMs: number;
}

export type OracleExecutionResult = OracleQueryResult | OracleUpdateResult;

export interface OracleConnectionHandle {
  execute(sql: string, options: OracleExecuteOptions): Promise<OracleExecutionResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

export interface OracleAdapter {
  connect(config: OracleConnectionConfig, password: string): Promise<OracleConnectionHandle>;
}

type OracleClientOptionsResolver = (config: OracleConnectionConfig) => OracleClientOptions;

export class NodeOracleAdapter implements OracleAdapter {
  private static initializedClientKey: string | undefined;

  constructor(private readonly clientOptions: OracleClientOptions | OracleClientOptionsResolver = { mode: "thin" }) {}

  async connect(config: OracleConnectionConfig, password: string): Promise<OracleConnectionHandle> {
    try {
      const clientOptions = this.resolveClientOptions(config);
      this.ensureOracleClientInitialized(clientOptions);
      const connection = await oracledb.getConnection({
        user: config.username,
        password,
        connectString: buildConnectString(config),
        configDir: clientOptions.configDir
      });

      return new NodeOracleConnectionHandle(connection);
    } catch (error) {
      throw normalizeConnectionError(error);
    }
  }

  private resolveClientOptions(config: OracleConnectionConfig): OracleClientOptions {
    return typeof this.clientOptions === "function" ? this.clientOptions(config) : this.clientOptions;
  }

  private ensureOracleClientInitialized(clientOptions: OracleClientOptions): void {
    const initKey = JSON.stringify({
      mode: clientOptions.mode,
      libDir: clientOptions.libraryDir,
      configDir: clientOptions.configDir
    });
    if (NodeOracleAdapter.initializedClientKey) {
      if (NodeOracleAdapter.initializedClientKey !== initKey) {
        throw new Error(
          "Oracle Client has already been initialized with a different client profile. Reload VS Code or use a separate VS Code window before testing a connection that uses another Oracle Client profile."
        );
      }
      return;
    }

    if (clientOptions.mode !== "thick") {
      NodeOracleAdapter.initializedClientKey = initKey;
      return;
    }

    const initOptions = {
      libDir: clientOptions.libraryDir,
      configDir: clientOptions.configDir
    };
    oracledb.initOracleClient(initOptions);
    NodeOracleAdapter.initializedClientKey = initKey;
  }
}

class NodeOracleConnectionHandle implements OracleConnectionHandle {
  constructor(private readonly connection: oracledb.Connection) {}

  async execute(sql: string, options: OracleExecuteOptions): Promise<OracleExecutionResult> {
    const startedAt = Date.now();
    const result = await this.connection.execute(sql, [], {
      autoCommit: false,
      maxRows: options.maxRows,
      outFormat: oracledb.OUT_FORMAT_ARRAY
    });
    const elapsedMs = Date.now() - startedAt;

    if (result.rows) {
      return {
        type: "query",
        columns: (result.metaData ?? []).map((column) => column.name ?? ""),
        rows: result.rows as unknown[][],
        hasMoreRows: (result.rows as unknown[]).length >= options.maxRows,
        elapsedMs
      };
    }

    return {
      type: "update",
      rowsAffected: result.rowsAffected ?? 0,
      elapsedMs
    };
  }

  async commit(): Promise<void> {
    await this.connection.commit();
  }

  async rollback(): Promise<void> {
    await this.connection.rollback();
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}

function buildConnectString(config: OracleConnectionConfig): string {
  if (config.type === "tnsnames") {
    return config.tnsAlias;
  }

  if (config.serviceName) {
    return `${config.host}:${config.port}/${config.serviceName}`;
  }

  if (config.sid) {
    return `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${config.host})(PORT=${config.port}))(CONNECT_DATA=(SID=${config.sid})))`;
  }

  return `${config.host}:${config.port}`;
}

function normalizeConnectionError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }

  if (error.message.includes("NJS-138")) {
    return new Error([
      error.message,
      "",
      "This usually means the database server is too old for node-oracledb Thin mode.",
      "Switch Oracle Script Workspace to Thick mode and configure an Oracle Instant Client or full Oracle Client directory.",
      "VS Code settings: oracleWorkspace.clientMode = thick, oracleWorkspace.oracleClientLibraryDir = <instantclient directory>."
    ].join("\n"));
  }

  return error;
}
