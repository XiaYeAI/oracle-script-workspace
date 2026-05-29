import * as assert from "assert";
import { readFileSync } from "fs";
import * as path from "path";

describe("Localization resources", () => {
  it("keeps package nls keys aligned between default and zh-cn", () => {
    const english = readJson("package.nls.json");
    const simplifiedChinese = readJson("package.nls.zh-cn.json");

    assert.deepStrictEqual(Object.keys(simplifiedChinese).sort(), Object.keys(english).sort());
  });

  it("keeps runtime l10n bundle keys aligned between default and zh-cn", () => {
    const english = readJson(path.join("l10n", "bundle.l10n.json"));
    const simplifiedChinese = readJson(path.join("l10n", "bundle.l10n.zh-cn.json"));

    assert.deepStrictEqual(Object.keys(simplifiedChinese).sort(), Object.keys(english).sort());
  });

  it("declares package nls keys for all package.json placeholders", () => {
    const packageJson = readJson("package.json");
    const english = readJson("package.nls.json");
    const placeholders = new Set<string>();

    collectPlaceholders(packageJson, placeholders);

    for (const key of placeholders) {
      assert.ok(Object.prototype.hasOwnProperty.call(english, key), `Missing package.nls key: ${key}`);
    }
  });

  it("uses Chinese labels for schema tree and results view entries", () => {
    const packageChinese = readJson("package.nls.zh-cn.json");
    const runtimeChinese = readJson(path.join("l10n", "bundle.l10n.zh-cn.json"));

    assert.strictEqual(packageChinese["viewContainer.title"], "Oracle 脚本工作台");
    assert.strictEqual(packageChinese["viewContainer.results.title"], "Oracle 脚本结果");
    assert.strictEqual(runtimeChinese["Schemas"], "模式");
    assert.strictEqual(runtimeChinese["No schemas loaded"], "尚未加载模式");
  });
});

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as Record<string, unknown>;
}

function collectPlaceholders(value: unknown, output: Set<string>): void {
  if (typeof value === "string") {
    const match = value.match(/^%(.+)%$/);
    if (match) {
      output.add(match[1]);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectPlaceholders(item, output));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectPlaceholders(item, output));
  }
}
