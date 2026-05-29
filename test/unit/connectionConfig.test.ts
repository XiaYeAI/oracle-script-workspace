import * as assert from "assert";
import { ConnectionConfigStore, OracleConnectionConfig } from "../../src/config/connectionConfig";

describe("ConnectionConfigStore", () => {
  const connections: OracleConnectionConfig[] = [
    {
      name: "DEV_KGDB",
      type: "custom",
      host: "127.0.0.1",
      port: 1521,
      serviceName: "orclpdb1",
      username: "kgdb"
    }
  ];

  function createStore(): ConnectionConfigStore {
    const config = {
      get<T>(section: string, defaultValue: T): T {
        if (section === "connections") {
          return connections as T;
        }
        return defaultValue;
      },
      async update() {
        throw new Error("update not expected");
      }
    };

    return new ConnectionConfigStore({
      getConfiguration() {
        return config;
      }
    });
  }

  it("returns a configured connection by name", () => {
    const store = createStore();

    assert.deepStrictEqual(store.getConnection("DEV_KGDB"), connections[0]);
  });

  it("returns undefined for an unknown connection", () => {
    const store = createStore();

    assert.strictEqual(store.getConnection("MISSING"), undefined);
  });

  it("adds or updates a connection in workspace configuration", async () => {
    const updates: Array<{ section: string; value: unknown; target: unknown }> = [];
    const store = new ConnectionConfigStore(
      {
        getConfiguration() {
          return {
            get<T>(section: string, defaultValue: T): T {
              if (section === "connections") {
                return connections as T;
              }
              return defaultValue;
            },
            async update(section: string, value: unknown, target: unknown): Promise<void> {
              updates.push({ section, value, target });
            }
          };
        }
      },
      "workspace"
    );

    const updated = {
      ...connections[0],
      host: "dev-host"
    } as OracleConnectionConfig;

    await store.addOrUpdateConnection(updated);

    assert.strictEqual(updates.length, 1);
    assert.strictEqual(updates[0].section, "connections");
    assert.strictEqual(updates[0].target, "workspace");
    assert.deepStrictEqual(updates[0].value, [
      {
        ...connections[0],
        host: "dev-host"
      }
    ]);
  });

  it("deletes a connection from workspace configuration", async () => {
    const updates: Array<{ section: string; value: unknown; target: unknown }> = [];
    const store = new ConnectionConfigStore(
      {
        getConfiguration() {
          return {
            get<T>(section: string, defaultValue: T): T {
              if (section === "connections") {
                return connections as T;
              }
              return defaultValue;
            },
            async update(section: string, value: unknown, target: unknown): Promise<void> {
              updates.push({ section, value, target });
            }
          };
        }
      },
      "workspace"
    );

    await store.deleteConnection("DEV_KGDB");

    assert.deepStrictEqual(updates[0], {
      section: "connections",
      value: [],
      target: "workspace"
    });
  });

  it("updates tnsnames.ora paths in workspace configuration", async () => {
    const updates: Array<{ section: string; value: unknown; target: unknown }> = [];
    const store = new ConnectionConfigStore(
      {
        getConfiguration() {
          return {
            get<T>(_section: string, defaultValue: T): T {
              return defaultValue;
            },
            async update(section: string, value: unknown, target: unknown): Promise<void> {
              updates.push({ section, value, target });
            }
          };
        }
      },
      "workspace"
    );

    await store.updateTnsnamesPaths(["a/tnsnames.ora", "a/tnsnames.ora", "b/tnsnames.ora"]);

    assert.deepStrictEqual(updates[0], {
      section: "tnsnamesPaths",
      value: ["a/tnsnames.ora", "b/tnsnames.ora"],
      target: "workspace"
    });
  });

  it("returns Oracle Client thick mode options from configuration", () => {
    const store = new ConnectionConfigStore({
      getConfiguration() {
        return {
          get<T>(section: string, defaultValue: T): T {
            const values: Record<string, unknown> = {
              clientMode: "thick",
              oracleClientLibraryDir: "C:/oracle/instantclient_19_22",
              oracleClientConfigDir: "C:/oracle/network/admin"
            };
            return (values[section] ?? defaultValue) as T;
          }
        };
      }
    });

    assert.deepStrictEqual(store.getOracleClientOptions(), {
      name: "Default",
      mode: "thick",
      libraryDir: "C:/oracle/instantclient_19_22",
      configDir: "C:/oracle/network/admin"
    });
  });

  it("returns configured Oracle Client profiles and resolves the profile selected by a connection", () => {
    const store = new ConnectionConfigStore({
      getConfiguration() {
        return {
          get<T>(section: string, defaultValue: T): T {
            const values: Record<string, unknown> = {
              clientProfiles: [
                { name: "Thin 12c+", mode: "thin" },
                {
                  name: "Legacy 10g",
                  mode: "thick",
                  libraryDir: "C:/oracle/instantclient_19_22",
                  configDir: "C:/oracle/network/admin"
                }
              ]
            };
            return (values[section] ?? defaultValue) as T;
          }
        };
      }
    });

    const connection = {
      ...connections[0],
      clientProfileName: "Legacy 10g"
    } as OracleConnectionConfig;

    assert.deepStrictEqual(store.listOracleClientProfiles(), [
      { name: "Thin 12c+", mode: "thin" },
      {
        name: "Legacy 10g",
        mode: "thick",
        libraryDir: "C:/oracle/instantclient_19_22",
        configDir: "C:/oracle/network/admin"
      }
    ]);
    assert.deepStrictEqual(store.getOracleClientOptionsForConnection(connection), {
      name: "Legacy 10g",
      mode: "thick",
      libraryDir: "C:/oracle/instantclient_19_22",
      configDir: "C:/oracle/network/admin"
    });
  });

  it("updates Oracle Client options in workspace configuration", async () => {
    const updates: Array<{ section: string; value: unknown; target: unknown }> = [];
    const store = new ConnectionConfigStore(
      {
        getConfiguration() {
          return {
            get<T>(_section: string, defaultValue: T): T {
              return defaultValue;
            },
            async update(section: string, value: unknown, target: unknown): Promise<void> {
              updates.push({ section, value, target });
            }
          };
        }
      },
      "workspace"
    );

    await store.updateOracleClientOptions({
      mode: "thick",
      libraryDir: "C:/oracle/instantclient_19_22",
      configDir: "C:/oracle/network/admin"
    });

    assert.deepStrictEqual(updates, [
      { section: "clientMode", value: "thick", target: "workspace" },
      { section: "oracleClientLibraryDir", value: "C:/oracle/instantclient_19_22", target: "workspace" },
      { section: "oracleClientConfigDir", value: "C:/oracle/network/admin", target: "workspace" }
    ]);
  });

  it("updates Oracle Client profiles in workspace configuration", async () => {
    const updates: Array<{ section: string; value: unknown; target: unknown }> = [];
    const store = new ConnectionConfigStore(
      {
        getConfiguration() {
          return {
            get<T>(_section: string, defaultValue: T): T {
              return defaultValue;
            },
            async update(section: string, value: unknown, target: unknown): Promise<void> {
              updates.push({ section, value, target });
            }
          };
        }
      },
      "workspace"
    );

    await store.updateOracleClientProfiles([
      { name: "Thin 12c+", mode: "thin" },
      { name: "Legacy 10g", mode: "thick", libraryDir: "C:/oracle/instantclient_19_22" }
    ]);

    assert.deepStrictEqual(updates, [
      {
        section: "clientProfiles",
        value: [
          { name: "Thin 12c+", mode: "thin" },
          { name: "Legacy 10g", mode: "thick", libraryDir: "C:/oracle/instantclient_19_22" }
        ],
        target: "workspace"
      }
    ]);
  });
});
