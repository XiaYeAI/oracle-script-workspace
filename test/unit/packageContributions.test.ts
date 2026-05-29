import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

describe("Package contributions", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
  );

  it("shows compact SQL editor title actions for run, explain, commit, and rollback", () => {
    const commands: Array<{ command: string; icon?: string }> = packageJson.contributes.commands;
    const editorTitle: Array<{ command: string; group: string }> = packageJson.contributes.menus["editor/title"];
    const expected = [
      "oracleWorkspace.runCurrentOrSelected",
      "oracleWorkspace.explainPlan",
      "oracleWorkspace.commit",
      "oracleWorkspace.rollback"
    ];

    for (const command of expected) {
      assert.ok(
        editorTitle.some((item) => item.command === command && item.group.startsWith("navigation")),
        `${command} should be in the editor title navigation group`
      );
      assert.ok(
        commands.find((item) => item.command === command)?.icon,
        `${command} should use an icon so the editor title stays compact`
      );
    }

    assert.ok(
      !editorTitle.some((item) => item.command === "oracleWorkspace.runScript"),
      "runScript should not be a separate editor title button"
    );
  });

  it("binds F8 to execute SQL and F5 to explain plan", () => {
    const keybindings: Array<{ command: string; key: string }> = packageJson.contributes.keybindings;

    assert.ok(keybindings.some((item) => item.command === "oracleWorkspace.runCurrentOrSelected" && item.key === "f8"));
    assert.ok(keybindings.some((item) => item.command === "oracleWorkspace.explainPlan" && item.key === "f5"));
    assert.ok(!keybindings.some((item) => item.command === "oracleWorkspace.runScript" && item.key === "f5"));
  });

  it("binds F12 to open object details without document links", () => {
    const keybindings: Array<{ command: string; key: string; when: string }> = packageJson.contributes.keybindings;

    assert.ok(keybindings.some((item) =>
      item.command === "oracleWorkspace.openObjectDetails" &&
      item.key === "f12" &&
      item.when.includes("editorLangId == sql")
    ));
  });

  it("contributes results as a bottom panel view", () => {
    assert.ok(packageJson.contributes.viewsContainers.panel.some((item: { id: string }) => item.id === "oracleWorkspaceResults"));
    assert.ok(packageJson.contributes.views.oracleWorkspaceResults.some((item: { id: string; type?: string }) =>
      item.id === "oracleWorkspace.results" && item.type === "webview"
    ));
  });

  it("declares WebviewView contributions as webview type", () => {
    const currentScript = packageJson.contributes.views.oracleWorkspace
      .find((item: { id: string; type?: string }) => item.id === "oracleWorkspace.currentScript");
    const results = packageJson.contributes.views.oracleWorkspaceResults
      .find((item: { id: string; type?: string }) => item.id === "oracleWorkspace.results");

    assert.strictEqual(currentScript?.type, "webview");
    assert.strictEqual(results?.type, "webview");
  });
});
