import { OracleExecutionResult } from "../connections/oracleAdapter";
import { literal, rowsOf } from "../tree/objectMetadataService";
import { ObjectDetailsRequest, ObjectDetailsTab } from "./objectDetailsPanel";

export interface ObjectDetailsSession {
  execute(connectionName: string, sql: string): Promise<OracleExecutionResult>;
}

export interface ObjectDetailsPasswordPrompt {
  ensurePassword(connectionName: string): Promise<void>;
}

export class OracleObjectDetailsService {
  constructor(
    private readonly session: ObjectDetailsSession,
    private readonly passwordPrompt: ObjectDetailsPasswordPrompt
  ) {}

  async getDetails(request: ObjectDetailsRequest): Promise<ObjectDetailsTab[]> {
    await this.passwordPrompt.ensurePassword(request.connectionName);

    switch (request.objectType) {
      case "TABLE":
        return this.getTableDetails(request);
      case "VIEW":
        return this.getViewDetails(request);
      case "PROCEDURE":
      case "FUNCTION":
        return this.getProgramDetails(request, request.objectType);
      case "PACKAGE":
      case "PACKAGE BODY":
        return this.getPackageDetails(request);
      case "INDEX":
        return this.getIndexDetails(request);
      default:
        return [
          { title: "DDL", kind: "code", content: await this.singleValue(request, ddlSql(request, request.objectType ?? "TABLE")) }
        ];
    }
  }

  private async getTableDetails(request: ObjectDetailsRequest): Promise<ObjectDetailsTab[]> {
    return [
      { title: "Columns", kind: "table", content: await this.records(request, columnsSql(request)) },
      { title: "Preview", kind: "table", content: await this.preview(request) },
      { title: "DDL", kind: "code", content: await this.singleValue(request, ddlSql(request, "TABLE")) },
      { title: "Indexes", kind: "table", content: await this.records(request, indexesSql(request)) },
      { title: "Constraints", kind: "table", content: await this.records(request, constraintsSql(request)) }
    ];
  }

  private async getViewDetails(request: ObjectDetailsRequest): Promise<ObjectDetailsTab[]> {
    return [
      { title: "Columns", kind: "table", content: await this.records(request, columnsSql(request)) },
      { title: "Preview", kind: "table", content: await this.preview(request) },
      { title: "View SQL", kind: "code", content: await this.singleValue(request, viewSql(request)) },
      { title: "DDL", kind: "code", content: await this.singleValue(request, ddlSql(request, "VIEW")) }
    ];
  }

  private async getProgramDetails(request: ObjectDetailsRequest, type: "PROCEDURE" | "FUNCTION"): Promise<ObjectDetailsTab[]> {
    return [
      { title: "Source", kind: "code", content: await this.source(request, type) },
      { title: "DDL", kind: "code", content: await this.singleValue(request, ddlSql(request, type)) },
      { title: "Arguments", kind: "table", content: await this.records(request, argumentsSql(request)) },
      { title: "Compile Errors", kind: "table", content: await this.records(request, compileErrorsSql(request)) }
    ];
  }

  private async getPackageDetails(request: ObjectDetailsRequest): Promise<ObjectDetailsTab[]> {
    return [
      { title: "Spec", kind: "code", content: await this.source(request, "PACKAGE") },
      { title: "Body", kind: "code", content: await this.source(request, "PACKAGE BODY") },
      { title: "DDL", kind: "code", content: await this.singleValue(request, ddlSql(request, "PACKAGE")) },
      { title: "Procedures/Functions", kind: "table", content: await this.records(request, packageMembersSql(request)) },
      { title: "Compile Errors", kind: "table", content: await this.records(request, compileErrorsSql(request)) }
    ];
  }

  private async getIndexDetails(request: ObjectDetailsRequest): Promise<ObjectDetailsTab[]> {
    return [
      { title: "Columns", kind: "table", content: await this.records(request, indexColumnsSql(request)) },
      { title: "DDL", kind: "code", content: await this.singleValue(request, ddlSql(request, "INDEX")) },
      { title: "Table", kind: "table", content: await this.records(request, indexTableSql(request)) }
    ];
  }

  private async records(request: ObjectDetailsRequest, sql: string): Promise<Record<string, unknown>[]> {
    const result = await this.session.execute(request.connectionName, sql);
    if (result.type !== "query") {
      return [];
    }

    return rowsOf(result).map((row) => {
      const record: Record<string, unknown> = {};
      result.columns.forEach((column, index) => {
        record[column] = row[index];
      });
      return record;
    });
  }

  private async singleValue(request: ObjectDetailsRequest, sql: string): Promise<string> {
    const result = await this.session.execute(request.connectionName, sql);
    const first = rowsOf(result)[0]?.[0];
    return toDisplayText(first);
  }

  private async source(request: ObjectDetailsRequest, type: string): Promise<string> {
    const rows = await this.records(
      request,
      [
        "select text from all_source",
        `where owner = ${literal(request.owner.toUpperCase())}`,
        `and name = ${literal(request.objectName.toUpperCase())}`,
        `and type = ${literal(type)}`,
        "order by line"
      ].join(" ")
    );
    return rows.map((row) => String(row.TEXT ?? "")).join("");
  }

  private async preview(request: ObjectDetailsRequest): Promise<Record<string, unknown>[]> {
    if (!isSafeIdentifier(request.owner) || !isSafeIdentifier(request.objectName)) {
      return [{ MESSAGE: "Preview is unavailable for quoted or special-character identifiers." }];
    }
    return this.records(request, `select * from ${request.owner}.${request.objectName} where rownum <= 50`);
  }
}

async function toDisplayText(value: unknown): Promise<string> {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  const maybeLob = value as {
    getData?: () => Promise<unknown>;
    setEncoding?: (encoding: BufferEncoding) => void;
    on?: (event: string, handler: (chunk?: unknown) => void) => unknown;
  };
  if (typeof maybeLob.getData === "function") {
    return toDisplayText(await maybeLob.getData());
  }
  if (typeof maybeLob.on === "function") {
    return readStreamValue(maybeLob);
  }

  return String(value);
}

function readStreamValue(lob: {
  setEncoding?: (encoding: BufferEncoding) => void;
  on?: (event: string, handler: (chunk?: unknown) => void) => unknown;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    lob.setEncoding?.("utf8");
    lob.on?.("data", (chunk) => chunks.push(String(chunk ?? "")));
    lob.on?.("end", () => resolve(chunks.join("")));
    lob.on?.("error", (error) => reject(error));
  });
}

function columnsSql(request: ObjectDetailsRequest): string {
  return [
    "select column_name, data_type, data_length, nullable, data_default",
    "from all_tab_columns",
    `where owner = ${literal(request.owner.toUpperCase())}`,
    `and table_name = ${literal(request.objectName.toUpperCase())}`,
    "order by column_id"
  ].join(" ");
}

function indexesSql(request: ObjectDetailsRequest): string {
  return [
    "select index_name, uniqueness, status, tablespace_name",
    "from all_indexes",
    `where table_owner = ${literal(request.owner.toUpperCase())}`,
    `and table_name = ${literal(request.objectName.toUpperCase())}`,
    "order by index_name"
  ].join(" ");
}

function constraintsSql(request: ObjectDetailsRequest): string {
  return [
    "select constraint_name, constraint_type, status, search_condition",
    "from all_constraints",
    `where owner = ${literal(request.owner.toUpperCase())}`,
    `and table_name = ${literal(request.objectName.toUpperCase())}`,
    "order by constraint_name"
  ].join(" ");
}

function viewSql(request: ObjectDetailsRequest): string {
  return [
    "select text from all_views",
    `where owner = ${literal(request.owner.toUpperCase())}`,
    `and view_name = ${literal(request.objectName.toUpperCase())}`
  ].join(" ");
}

function argumentsSql(request: ObjectDetailsRequest): string {
  return [
    "select argument_name, position, sequence, data_type, in_out",
    "from all_arguments",
    `where owner = ${literal(request.owner.toUpperCase())}`,
    `and object_name = ${literal(request.objectName.toUpperCase())}`,
    "order by sequence"
  ].join(" ");
}

function packageMembersSql(request: ObjectDetailsRequest): string {
  return [
    "select procedure_name, object_name, overload",
    "from all_arguments",
    `where owner = ${literal(request.owner.toUpperCase())}`,
    `and package_name = ${literal(request.objectName.toUpperCase())}`,
    "group by procedure_name, object_name, overload",
    "order by procedure_name"
  ].join(" ");
}

function compileErrorsSql(request: ObjectDetailsRequest): string {
  return [
    "select type, sequence, line, position, text",
    "from all_errors",
    `where owner = ${literal(request.owner.toUpperCase())}`,
    `and name = ${literal(request.objectName.toUpperCase())}`,
    "order by type, sequence"
  ].join(" ");
}

function indexColumnsSql(request: ObjectDetailsRequest): string {
  return [
    "select column_name, column_position, descend",
    "from all_ind_columns",
    `where index_owner = ${literal(request.owner.toUpperCase())}`,
    `and index_name = ${literal(request.objectName.toUpperCase())}`,
    "order by column_position"
  ].join(" ");
}

function indexTableSql(request: ObjectDetailsRequest): string {
  return [
    "select owner, index_name, table_owner, table_name, uniqueness, status",
    "from all_indexes",
    `where owner = ${literal(request.owner.toUpperCase())}`,
    `and index_name = ${literal(request.objectName.toUpperCase())}`
  ].join(" ");
}

function ddlSql(request: ObjectDetailsRequest, type: string): string {
  return `select dbms_metadata.get_ddl(${literal(type)}, ${literal(request.objectName.toUpperCase())}, ${literal(request.owner.toUpperCase())}) from dual`;
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_$#]*$/.test(value);
}
