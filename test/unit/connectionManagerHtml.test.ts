import * as assert from "assert";
import { JSDOM } from "jsdom";
import { renderConnectionManagerHtml } from "../../src/connectionManager/connectionManagerHtml";
import { ConnectionManagerState } from "../../src/connectionManager/connectionManagerTypes";

describe("ConnectionManagerHtml", () => {
  function createState(): ConnectionManagerState {
    return {
      mode: "add",
      connections: [],
      tnsnamesPaths: ["D:/oracle/network/admin/tnsnames.ora"],
      aliases: [{ alias: "KGDB_UAT", sourcePath: "D:/oracle/network/admin/tnsnames.ora" }],
      parseErrors: [],
      clientOptions: { name: "Default", mode: "thin" },
      clientProfiles: [
        { name: "Default", mode: "thin" },
        { name: "Legacy 10g", mode: "thick", libraryDir: "C:/oracle/instantclient_19_22" }
      ]
    };
  }

  it("renders a unified form instead of sequential input prompts", () => {
    const html = renderConnectionManagerHtml(createState());

    assert.ok(html.includes("Connection Manager"));
    assert.ok(html.includes("TNS Names"));
    assert.ok(html.includes("Oracle Client"));
    assert.ok(html.includes("Custom Oracle"));
    assert.ok(html.includes("TNS Alias"));
    assert.ok(html.includes("Connection Identifier"));
    assert.ok(html.includes("Test Connection"));
    assert.ok(html.includes("KGDB_UAT"));
    assert.ok(html.includes("identifierService"));
    assert.ok(html.includes("identifierSid"));
  });

  it("posts a TNS login message from the alias workflow", () => {
    const messages: unknown[] = [];
    const dom = new JSDOM(renderConnectionManagerHtml(createState()), {
      runScripts: "dangerously",
      beforeParse(window) {
        (window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
          postMessage(message: unknown) {
            messages.push(message);
          }
        });
      }
    });
    const document = dom.window.document;

    document.getElementById("tabTns")?.click();
    (document.getElementById("tnsUsername") as HTMLInputElement).value = "KGDB";
    document.getElementById("tnsUsername")?.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    (document.getElementById("tnsPassword") as HTMLInputElement).value = "secret";
    (document.getElementById("tnsRememberPassword") as HTMLInputElement).checked = true;
    (document.getElementById("tnsClientProfile") as HTMLSelectElement).value = "Legacy 10g";
    document.getElementById("saveTnsLogin")?.click();

    assert.deepStrictEqual(JSON.parse(JSON.stringify(messages[0])), {
      action: "saveTnsLogin",
      connection: {
        name: "KGDB_UAT@KGDB",
        type: "tnsnames",
        tnsAlias: "KGDB_UAT",
        username: "KGDB",
        clientProfileName: "Legacy 10g"
      },
      password: "secret",
      rememberPassword: true,
      setCurrentScript: false
    });
  });

  it("posts the selected client profile from the custom connection form", () => {
    const messages: unknown[] = [];
    const dom = new JSDOM(renderConnectionManagerHtml(createState()), {
      runScripts: "dangerously",
      beforeParse(window) {
        (window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
          postMessage(message: unknown) {
            messages.push(message);
          }
        });
      }
    });
    const document = dom.window.document;

    (document.getElementById("name") as HTMLInputElement).value = "DEV_LEGACY";
    (document.getElementById("username") as HTMLInputElement).value = "KGDB";
    (document.getElementById("host") as HTMLInputElement).value = "127.0.0.1";
    (document.getElementById("serviceName") as HTMLInputElement).value = "orcl";
    (document.getElementById("clientProfile") as HTMLSelectElement).value = "Legacy 10g";
    document.getElementById("form")?.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));

    assert.deepStrictEqual(JSON.parse(JSON.stringify(messages[0])), {
      action: "saveConnection",
      connection: {
        name: "DEV_LEGACY",
        type: "custom",
        username: "KGDB",
        host: "127.0.0.1",
        port: 1521,
        serviceName: "orcl",
        clientProfileName: "Legacy 10g"
      },
      rememberPassword: false
    });
  });

  it("posts Oracle Client profiles from the UI", () => {
    const messages: unknown[] = [];
    const dom = new JSDOM(renderConnectionManagerHtml(createState()), {
      runScripts: "dangerously",
      beforeParse(window) {
        (window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
          postMessage(message: unknown) {
            messages.push(message);
          }
        });
      }
    });
    const document = dom.window.document;

    document.getElementById("tabClient")?.click();
    (document.getElementById("clientProfileName") as HTMLInputElement).value = "Legacy 10g";
    document.getElementById("clientThick")?.click();
    (document.getElementById("clientLibraryDir") as HTMLInputElement).value = "C:/oracle/instantclient_19_22";
    (document.getElementById("clientConfigDir") as HTMLInputElement).value = "C:/oracle/network/admin";
    document.getElementById("saveClientOptions")?.click();

    assert.deepStrictEqual(JSON.parse(JSON.stringify(messages[0])), {
      action: "saveClientProfiles",
      profiles: [
        { name: "Default", mode: "thin" },
        {
          name: "Legacy 10g",
          mode: "thick",
          libraryDir: "C:/oracle/instantclient_19_22",
          configDir: "C:/oracle/network/admin"
        }
      ]
    });
  });
});
