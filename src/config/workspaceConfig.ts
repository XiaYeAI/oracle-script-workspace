import * as fs from "fs/promises";
import * as path from "path";

export interface OracleWorkspaceFile {
  scriptConnections: Record<string, string>;
  recentSchemas: Record<string, string[]>;
  favoriteSchemas: Record<string, string[]>;
}

const DEFAULT_WORKSPACE_FILE: OracleWorkspaceFile = {
  scriptConnections: {},
  recentSchemas: {},
  favoriteSchemas: {}
};

export class WorkspaceConfigStore {
  private readonly configPath: string;

  constructor(private readonly workspaceRoot: string) {
    this.configPath = path.join(workspaceRoot, ".vscode", "oracle-workspace.json");
  }

  async read(): Promise<OracleWorkspaceFile> {
    try {
      const raw = await fs.readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<OracleWorkspaceFile>;

      return {
        scriptConnections: parsed.scriptConnections ?? {},
        recentSchemas: parsed.recentSchemas ?? {},
        favoriteSchemas: parsed.favoriteSchemas ?? {}
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return { ...DEFAULT_WORKSPACE_FILE };
      }

      throw error;
    }
  }

  async write(value: OracleWorkspaceFile): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  async getConnectionForScript(fileName: string): Promise<string | undefined> {
    const config = await this.read();
    return config.scriptConnections[path.basename(fileName)];
  }

  async setConnectionForScript(fileName: string, connectionName: string): Promise<void> {
    const config = await this.read();
    config.scriptConnections[path.basename(fileName)] = connectionName;
    await this.write(config);
  }

  async renameScriptConnection(oldName: string, newName: string): Promise<void> {
    const config = await this.read();
    for (const [fileName, connectionName] of Object.entries(config.scriptConnections)) {
      if (connectionName === oldName) {
        config.scriptConnections[fileName] = newName;
      }
    }
    await this.write(config);
  }

  async addRecentSchema(connectionName: string, schema: string): Promise<void> {
    const config = await this.read();
    const normalized = schema.toUpperCase();
    const current = config.recentSchemas[connectionName] ?? [];
    config.recentSchemas[connectionName] = [
      normalized,
      ...current.filter((item) => item.toUpperCase() !== normalized)
    ].slice(0, 10);
    await this.write(config);
  }

  async listRecentSchemas(connectionName: string): Promise<string[]> {
    const config = await this.read();
    return config.recentSchemas[connectionName] ?? [];
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
