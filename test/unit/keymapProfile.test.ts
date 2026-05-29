import * as assert from "assert";
import {
  KeymapProfile,
  KeymapProfileService,
  KeymapProfileVscodeApi
} from "../../src/ui/keymapProfile";

function createMockApi(initialProfile?: string, pickedProfile?: KeymapProfile): {
  api: KeymapProfileVscodeApi;
  contextCalls: unknown[][];
  updated: Array<{ section: string; value: unknown; target?: unknown }>;
} {
  const contextCalls: unknown[][] = [];
  const updated: Array<{ section: string; value: unknown; target?: unknown }> = [];

  const api: KeymapProfileVscodeApi = {
    ConfigurationTarget: { Global: "global" },
    commands: {
      async executeCommand(command: string, ...rest: unknown[]) {
        contextCalls.push([command, ...rest]);
      }
    },
    window: {
      async showQuickPick(items) {
        return items.find((item) => item.profile === pickedProfile);
      }
    },
    workspace: {
      getConfiguration() {
        return {
          get<T>(_section: string, defaultValue: T): T {
            return (initialProfile ?? defaultValue) as T;
          },
          async update(section: string, value: unknown, target?: unknown) {
            updated.push({ section, value, target });
          }
        };
      }
    }
  };

  return { api, contextCalls, updated };
}

describe("KeymapProfileService", () => {
  it("defaults to sqlDeveloper when configuration is missing", () => {
    const { api } = createMockApi();
    const service = new KeymapProfileService(api);

    assert.strictEqual(service.getCurrentProfile(), "sqlDeveloper");
  });

  it("falls back to sqlDeveloper when configuration is invalid", () => {
    const { api } = createMockApi("invalid-profile");
    const service = new KeymapProfileService(api);

    assert.strictEqual(service.getCurrentProfile(), "sqlDeveloper");
  });

  it("apply updates the VS Code context key", async () => {
    const { api, contextCalls } = createMockApi();
    const service = new KeymapProfileService(api);

    await service.apply("plsqlDeveloper");

    assert.deepStrictEqual(contextCalls, [
      ["setContext", "oracleWorkspace.keymapProfile", "plsqlDeveloper"]
    ]);
  });

  it("switchProfile persists selected profile and applies context", async () => {
    const { api, contextCalls, updated } = createMockApi("sqlDeveloper", "plsqlDeveloper");
    const service = new KeymapProfileService(api);

    const profile = await service.switchProfile();

    assert.strictEqual(profile, "plsqlDeveloper");
    assert.deepStrictEqual(updated, [
      { section: "keymapProfile", value: "plsqlDeveloper", target: "global" }
    ]);
    assert.deepStrictEqual(contextCalls, [
      ["setContext", "oracleWorkspace.keymapProfile", "plsqlDeveloper"]
    ]);
  });
});
