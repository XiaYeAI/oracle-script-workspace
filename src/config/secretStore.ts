export interface SecretStorageLike {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
}

export function makePasswordSecretKey(connectionName: string, username: string): string {
  return `oracleWorkspace.password:${connectionName}:${username}`;
}

export class SecretStore {
  constructor(private readonly secrets: SecretStorageLike) {}

  async getPassword(connectionName: string, username: string): Promise<string | undefined> {
    return this.secrets.get(makePasswordSecretKey(connectionName, username));
  }

  async savePassword(connectionName: string, username: string, password: string): Promise<void> {
    await this.secrets.store(makePasswordSecretKey(connectionName, username), password);
  }

  async deletePassword(connectionName: string, username: string): Promise<void> {
    await this.secrets.delete(makePasswordSecretKey(connectionName, username));
  }
}
