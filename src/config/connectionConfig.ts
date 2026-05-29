export type OracleConnectionConfig = CustomOracleConnection | TnsOracleConnection;
export type OracleClientMode = "thin" | "thick";

export interface OracleClientOptions {
  name?: string;
  mode: OracleClientMode;
  libraryDir?: string;
  configDir?: string;
}

export interface OracleClientProfile extends OracleClientOptions {
  name: string;
}

interface BaseOracleConnection {
  name: string;
  username: string;
  note?: string;
  clientProfileName?: string;
}

export interface CustomOracleConnection extends BaseOracleConnection {
  type: "custom";
  host: string;
  port: number;
  serviceName?: string;
  sid?: string;
}

export interface TnsOracleConnection extends BaseOracleConnection {
  type: "tnsnames";
  tnsAlias: string;
}

export interface ConnectionConfiguration {
  get<T>(section: string, defaultValue: T): T;
  update?(section: string, value: unknown, target?: unknown): Thenable<void>;
}

export interface ConnectionWorkspace {
  getConfiguration(section?: string): ConnectionConfiguration;
}

export class ConnectionConfigStore {
  constructor(
    private readonly workspace: ConnectionWorkspace,
    private readonly updateTarget?: unknown
  ) {}

  listConfiguredConnections(): OracleConnectionConfig[] {
    return this.workspace
      .getConfiguration("oracleWorkspace")
      .get<OracleConnectionConfig[]>("connections", []);
  }

  getConnection(connectionName: string): OracleConnectionConfig | undefined {
    return this.listConfiguredConnections().find((connection) => connection.name === connectionName);
  }

  async addOrUpdateConnection(connection: OracleConnectionConfig): Promise<void> {
    const configuration = this.workspace.getConfiguration("oracleWorkspace");
    if (!configuration.update) {
      throw new Error("VS Code configuration update API is not available.");
    }

    const current = this.listConfiguredConnections();
    const next = current.filter((item) => item.name !== connection.name);
    next.push(connection);
    await configuration.update("connections", next, this.updateTarget);
  }

  async deleteConnection(connectionName: string): Promise<void> {
    const configuration = this.workspace.getConfiguration("oracleWorkspace");
    if (!configuration.update) {
      throw new Error("VS Code configuration update API is not available.");
    }

    const next = this.listConfiguredConnections().filter((item) => item.name !== connectionName);
    await configuration.update("connections", next, this.updateTarget);
  }

  async updateTnsnamesPaths(paths: string[]): Promise<void> {
    const configuration = this.workspace.getConfiguration("oracleWorkspace");
    if (!configuration.update) {
      throw new Error("VS Code configuration update API is not available.");
    }

    await configuration.update("tnsnamesPaths", [...new Set(paths)], this.updateTarget);
  }

  listTnsnamesPaths(): string[] {
    return this.workspace
      .getConfiguration("oracleWorkspace")
      .get<string[]>("tnsnamesPaths", []);
  }

  getMaxRows(): number {
    return this.workspace.getConfiguration("oracleWorkspace").get<number>("maxRows", 500);
  }

  getOracleClientOptions(): OracleClientOptions {
    const configuration = this.workspace.getConfiguration("oracleWorkspace");
    const mode = configuration.get<OracleClientMode>("clientMode", "thin");
    return {
      name: "Default",
      mode: mode === "thick" ? "thick" : "thin",
      libraryDir: emptyToUndefined(configuration.get<string>("oracleClientLibraryDir", "")),
      configDir: emptyToUndefined(configuration.get<string>("oracleClientConfigDir", ""))
    };
  }

  listOracleClientProfiles(): OracleClientProfile[] {
    const profiles = this.workspace
      .getConfiguration("oracleWorkspace")
      .get<OracleClientProfile[]>("clientProfiles", []);
    const normalized = profiles
      .map((profile) => normalizeProfile(profile))
      .filter((profile): profile is OracleClientProfile => Boolean(profile));

    return normalized.length > 0 ? normalized : [this.getDefaultOracleClientProfile()];
  }

  getOracleClientOptionsForConnection(connection: OracleConnectionConfig): OracleClientOptions {
    const profiles = this.listOracleClientProfiles();
    return profiles.find((profile) => profile.name === connection.clientProfileName) ?? profiles[0];
  }

  async updateOracleClientOptions(options: OracleClientOptions): Promise<void> {
    const configuration = this.workspace.getConfiguration("oracleWorkspace");
    if (!configuration.update) {
      throw new Error("VS Code configuration update API is not available.");
    }

    await configuration.update("clientMode", options.mode, this.updateTarget);
    await configuration.update("oracleClientLibraryDir", options.libraryDir ?? "", this.updateTarget);
    await configuration.update("oracleClientConfigDir", options.configDir ?? "", this.updateTarget);
  }

  async updateOracleClientProfiles(profiles: OracleClientProfile[]): Promise<void> {
    const configuration = this.workspace.getConfiguration("oracleWorkspace");
    if (!configuration.update) {
      throw new Error("VS Code configuration update API is not available.");
    }

    const normalized = profiles
      .map((profile) => normalizeProfile(profile))
      .filter((profile): profile is OracleClientProfile => Boolean(profile));
    await configuration.update(
      "clientProfiles",
      normalized.length > 0 ? normalized : [this.getDefaultOracleClientProfile()],
      this.updateTarget
    );
  }

  private getDefaultOracleClientProfile(): OracleClientProfile {
    const legacy = this.getOracleClientOptions();
    const profile: OracleClientProfile = {
      name: legacy.name ?? "Default",
      mode: legacy.mode
    };
    if (legacy.libraryDir) {
      profile.libraryDir = legacy.libraryDir;
    }
    if (legacy.configDir) {
      profile.configDir = legacy.configDir;
    }
    return profile;
  }
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeProfile(profile: OracleClientProfile): OracleClientProfile | undefined {
  const name = profile.name?.trim();
  if (!name) {
    return undefined;
  }

  const normalized: OracleClientProfile = {
    name,
    mode: profile.mode === "thick" ? "thick" : "thin"
  };
  const libraryDir = emptyToUndefined(profile.libraryDir ?? "");
  const configDir = emptyToUndefined(profile.configDir ?? "");
  if (libraryDir) {
    normalized.libraryDir = libraryDir;
  }
  if (configDir) {
    normalized.configDir = configDir;
  }
  return normalized;
}
