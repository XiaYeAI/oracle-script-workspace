export type KeymapProfile = "sqlDeveloper" | "plsqlDeveloper" | "custom";

export interface KeymapProfileConfiguration {
  get<T>(section: string, defaultValue: T): T;
  update(section: string, value: unknown, target?: unknown): Thenable<void>;
}

export interface KeymapProfileWindow {
  showQuickPick(
    items: Array<{ label: string; profile: KeymapProfile; description: string }>,
    options: { placeHolder: string }
  ): Thenable<{ label: string; profile: KeymapProfile; description: string } | undefined>;
}

export interface KeymapProfileCommands {
  executeCommand(command: string, ...rest: unknown[]): Thenable<unknown>;
}

export interface KeymapProfileWorkspace {
  getConfiguration(section?: string): KeymapProfileConfiguration;
}

export interface KeymapProfileVscodeApi {
  commands: KeymapProfileCommands;
  window: KeymapProfileWindow;
  workspace: KeymapProfileWorkspace;
  ConfigurationTarget?: { Global: unknown };
}

const PROFILE_CONTEXT = "oracleWorkspace.keymapProfile";
const DEFAULT_PROFILE: KeymapProfile = "sqlDeveloper";
const VALID_PROFILES: KeymapProfile[] = ["sqlDeveloper", "plsqlDeveloper", "custom"];

export class KeymapProfileService {
  constructor(
    private readonly vscodeApi: KeymapProfileVscodeApi,
    private readonly localize: (message: string, ...args: Array<string | number | boolean>) => string = (message) => message
  ) {}

  async apply(profile: KeymapProfile): Promise<void> {
    await this.vscodeApi.commands.executeCommand("setContext", PROFILE_CONTEXT, profile);
  }

  async switchProfile(): Promise<KeymapProfile | undefined> {
    const picked = await this.vscodeApi.window.showQuickPick(
      [
        {
          label: this.localize("SQL Developer"),
          profile: "sqlDeveloper",
          description: this.localize("Ctrl+Enter executes SQL, F5 runs script")
        },
        {
          label: this.localize("PL/SQL Developer"),
          profile: "plsqlDeveloper",
          description: this.localize("F8 executes SQL, F5 explains plan")
        },
        {
          label: this.localize("Custom"),
          profile: "custom",
          description: this.localize("Use user-defined VS Code keybindings")
        }
      ],
      { placeHolder: this.localize("Select Oracle Script Workspace keymap profile") }
    );

    if (!picked) {
      return undefined;
    }

    await this.vscodeApi.workspace
      .getConfiguration("oracleWorkspace")
      .update("keymapProfile", picked.profile, this.vscodeApi.ConfigurationTarget?.Global);
    await this.apply(picked.profile);

    return picked.profile;
  }

  getCurrentProfile(): KeymapProfile {
    const profile = this.vscodeApi.workspace
      .getConfiguration("oracleWorkspace")
      .get<KeymapProfile>("keymapProfile", DEFAULT_PROFILE);

    return VALID_PROFILES.includes(profile) ? profile : DEFAULT_PROFILE;
  }
}
