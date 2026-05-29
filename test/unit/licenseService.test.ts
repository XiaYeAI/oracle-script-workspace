import * as assert from "assert";
import { LicenseService, LicenseState } from "../../src/license/licenseService";

class MemoryState {
  value: LicenseState | undefined;

  get<T>(_key: string): T | undefined {
    return this.value as T | undefined;
  }

  async update(_key: string, value: unknown): Promise<void> {
    this.value = value as LicenseState;
  }
}

describe("LicenseService", () => {
  it("defaults to free and does not block features", async () => {
    const service = new LicenseService(new MemoryState());

    assert.deepStrictEqual(await service.getState(), {
      status: "free",
      plan: "free"
    });
    assert.strictEqual(await service.isFeatureEnabled("objectDetails"), true);
  });

  it("stores placeholder sign-in state globally", async () => {
    const state = new MemoryState();
    const service = new LicenseService(state);

    const next = await service.signInPlaceholder();

    assert.strictEqual(next.status, "free");
    assert.strictEqual(next.plan, "free");
    assert.strictEqual(next.email, "local-user");
    assert.deepStrictEqual(await service.getState(), next);
  });

  it("signs out back to free state", async () => {
    const service = new LicenseService(new MemoryState());

    await service.signInPlaceholder();
    const next = await service.signOut();

    assert.deepStrictEqual(next, {
      status: "free",
      plan: "free"
    });
  });
});
