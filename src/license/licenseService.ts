export type LicensePlan = "free" | "pro" | "team";
export type LicenseStatus = "notSignedIn" | "free" | "trial" | "active" | "expired";

export interface LicenseState {
  status: LicenseStatus;
  plan: LicensePlan;
  email?: string;
  expiresAt?: string;
}

export interface GlobalStateLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

const LICENSE_STATE_KEY = "oracleWorkspace.licenseState";
const DEFAULT_LICENSE_STATE: LicenseState = {
  status: "free",
  plan: "free"
};

export class LicenseService {
  constructor(private readonly globalState: GlobalStateLike) {}

  async getState(): Promise<LicenseState> {
    return this.globalState.get<LicenseState>(LICENSE_STATE_KEY) ?? DEFAULT_LICENSE_STATE;
  }

  async signInPlaceholder(): Promise<LicenseState> {
    const state: LicenseState = {
      status: "free",
      plan: "free",
      email: "local-user"
    };
    await this.globalState.update(LICENSE_STATE_KEY, state);
    return state;
  }

  async signOut(): Promise<LicenseState> {
    await this.globalState.update(LICENSE_STATE_KEY, DEFAULT_LICENSE_STATE);
    return DEFAULT_LICENSE_STATE;
  }

  async isFeatureEnabled(_feature: string): Promise<boolean> {
    return true;
  }
}
