import { OracleConnectionConfig } from "../config/connectionConfig";
import {
  OracleAdapter,
  OracleConnectionHandle,
  OracleExecutionResult
} from "./oracleAdapter";

export interface ConnectionConfigProvider {
  getConnection(connectionName: string): Promise<OracleConnectionConfig | undefined>;
}

export interface PasswordProvider {
  getPassword(connectionName: string, username: string): Promise<string | undefined>;
}

interface SessionState {
  handle: OracleConnectionHandle;
  hasUncommittedChanges: boolean;
}

export class OracleSessionManager {
  private readonly sessions = new Map<string, SessionState>();

  constructor(
    private readonly adapter: OracleAdapter,
    private readonly connectionProvider: ConnectionConfigProvider,
    private readonly passwordProvider: PasswordProvider,
    private readonly maxRows = 500
  ) {}

  async getOrCreateSession(connectionName: string): Promise<OracleConnectionHandle> {
    const existing = this.sessions.get(connectionName);
    if (existing) {
      return existing.handle;
    }

    const config = await this.connectionProvider.getConnection(connectionName);
    if (!config) {
      throw new Error(`Connection '${connectionName}' is not configured.`);
    }

    const password = await this.passwordProvider.getPassword(connectionName, config.username);
    if (!password) {
      throw new Error(`Password for connection '${connectionName}' and user '${config.username}' is not saved.`);
    }

    const handle = await this.adapter.connect(config, password);
    this.sessions.set(connectionName, { handle, hasUncommittedChanges: false });

    return handle;
  }

  async execute(connectionName: string, sql: string): Promise<OracleExecutionResult> {
    const handle = await this.getOrCreateSession(connectionName);
    const result = await handle.execute(sql, { maxRows: this.maxRows });

    if (result.type === "update") {
      const session = this.sessions.get(connectionName);
      if (session) {
        session.hasUncommittedChanges = true;
      }
    }

    return result;
  }

  async commit(connectionName: string): Promise<void> {
    const handle = await this.getOrCreateSession(connectionName);
    await handle.commit();
    this.markClean(connectionName);
  }

  async rollback(connectionName: string): Promise<void> {
    const handle = await this.getOrCreateSession(connectionName);
    await handle.rollback();
    this.markClean(connectionName);
  }

  hasUncommittedChanges(connectionName: string): boolean {
    return this.sessions.get(connectionName)?.hasUncommittedChanges ?? false;
  }

  async close(connectionName: string): Promise<void> {
    const session = this.sessions.get(connectionName);
    if (!session) {
      return;
    }

    await session.handle.close();
    this.sessions.delete(connectionName);
  }

  private markClean(connectionName: string): void {
    const session = this.sessions.get(connectionName);
    if (session) {
      session.hasUncommittedChanges = false;
    }
  }
}
