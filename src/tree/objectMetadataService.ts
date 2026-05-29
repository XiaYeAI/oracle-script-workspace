export type OracleObjectType =
  | "TABLE"
  | "VIEW"
  | "INDEX"
  | "SEQUENCE"
  | "SYNONYM"
  | "PROCEDURE"
  | "FUNCTION"
  | "PACKAGE"
  | "PACKAGE BODY"
  | "TRIGGER";

export interface OracleSchemaObject {
  owner: string;
  objectName: string;
  objectType: OracleObjectType;
  status?: string;
}

export interface ObjectMetadataService {
  listDefaultSchemas(connectionName: string): Promise<string[]>;
  searchSchemas(connectionName: string, pattern: string): Promise<string[]>;
  listObjects(
    connectionName: string,
    schema: string,
    type: OracleObjectType
  ): Promise<OracleSchemaObject[]>;
}

export const ORACLE_OBJECT_TYPES: OracleObjectType[] = [
  "TABLE",
  "VIEW",
  "INDEX",
  "SEQUENCE",
  "SYNONYM",
  "PROCEDURE",
  "FUNCTION",
  "PACKAGE",
  "PACKAGE BODY",
  "TRIGGER"
];

export class EmptyObjectMetadataService implements ObjectMetadataService {
  async listDefaultSchemas(_connectionName: string): Promise<string[]> {
    return [];
  }

  async searchSchemas(_connectionName: string, _pattern: string): Promise<string[]> {
    return [];
  }

  async listObjects(
    _connectionName: string,
    _schema: string,
    _type: OracleObjectType
  ): Promise<OracleSchemaObject[]> {
    return [];
  }
}

export interface ObjectMetadataSession {
  execute(connectionName: string, sql: string): Promise<{
    type: "query" | "update";
    columns?: string[];
    rows?: unknown[][];
  }>;
}

export interface ObjectMetadataPasswordPrompt {
  ensurePassword(connectionName: string): Promise<void>;
}

export class OracleObjectMetadataService implements ObjectMetadataService {
  constructor(
    private readonly session: ObjectMetadataSession,
    private readonly passwordPrompt: ObjectMetadataPasswordPrompt
  ) {}

  async listDefaultSchemas(connectionName: string): Promise<string[]> {
    await this.passwordPrompt.ensurePassword(connectionName);
    const result = await this.session.execute(connectionName, "select username from user_users");
    return rowsOf(result).map((row) => String(row[0])).filter(Boolean);
  }

  async searchSchemas(connectionName: string, pattern: string): Promise<string[]> {
    await this.passwordPrompt.ensurePassword(connectionName);
    const result = await this.session.execute(
      connectionName,
      `select username from all_users where username like ${literal(`%${pattern.toUpperCase()}%`)} order by username`
    );
    return rowsOf(result).map((row) => String(row[0])).filter(Boolean);
  }

  async listObjects(
    connectionName: string,
    schema: string,
    type: OracleObjectType
  ): Promise<OracleSchemaObject[]> {
    await this.passwordPrompt.ensurePassword(connectionName);
    const result = await this.session.execute(
      connectionName,
      [
        "select owner, object_name, object_type, status from (",
        "select owner, object_name, object_type, status",
        "from all_objects",
        `where owner = ${literal(schema.toUpperCase())}`,
        `and object_type = ${literal(type)}`,
        "order by object_name",
        ") where rownum <= 200"
      ].join(" ")
    );

    return rowsOf(result).map((row) => ({
      owner: String(row[0]),
      objectName: String(row[1]),
      objectType: row[2] as OracleObjectType,
      status: row[3] ? String(row[3]) : undefined
    }));
  }

  async findObjects(
    connectionName: string,
    objectName: string,
    owner?: string
  ): Promise<OracleSchemaObject[]> {
    await this.passwordPrompt.ensurePassword(connectionName);
    const filters = [`object_name = ${literal(objectName.toUpperCase())}`];
    if (owner) {
      filters.push(`owner = ${literal(owner.toUpperCase())}`);
    }

    const result = await this.session.execute(
      connectionName,
      [
        "select owner, object_name, object_type, status",
        "from all_objects",
        `where ${filters.join(" and ")}`,
        `and object_type in (${ORACLE_OBJECT_TYPES.map(literal).join(", ")})`,
        "order by owner, object_type"
      ].join(" ")
    );

    return rowsOf(result).map((row) => ({
      owner: String(row[0]),
      objectName: String(row[1]),
      objectType: row[2] as OracleObjectType,
      status: row[3] ? String(row[3]) : undefined
    }));
  }
}

export function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function rowsOf(result: { type: "query" | "update"; rows?: unknown[][] }): unknown[][] {
  return result.type === "query" && result.rows ? result.rows : [];
}
