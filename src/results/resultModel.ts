import { randomUUID } from "crypto";
import { OracleExecutionResult } from "../connections/oracleAdapter";

export interface ExecutionBatch {
  id: string;
  connectionName: string;
  startedAt: string;
  items: ExecutionResultItem[];
}

export type ExecutionResultItem =
  | {
      kind: "query";
      title: string;
      columns: string[];
      rows: unknown[][];
      hasMoreRows: boolean;
      elapsedMs: number;
    }
  | {
      kind: "update";
      title: string;
      rowsAffected: number;
      elapsedMs: number;
    }
  | {
      kind: "message";
      title: string;
      message: string;
      elapsedMs?: number;
    }
  | {
      kind: "error";
      title: string;
      message: string;
      startLine?: number;
    };

export function createExecutionBatch(
  connectionName: string,
  results: OracleExecutionResult[],
  sourceSqls: string[] = []
): ExecutionBatch {
  return {
    id: randomUUID(),
    connectionName,
    startedAt: new Date().toISOString(),
    items: results.map((result, index) => toResultItem(result, index + 1, sourceSqls[index]))
  };
}

export function createMessageBatch(
  connectionName: string,
  title: string,
  message: string
): ExecutionBatch {
  return {
    id: randomUUID(),
    connectionName,
    startedAt: new Date().toISOString(),
    items: [{ kind: "message", title, message }]
  };
}

export function createErrorBatch(
  connectionName: string,
  message: string,
  startLine?: number
): ExecutionBatch {
  return {
    id: randomUUID(),
    connectionName,
    startedAt: new Date().toISOString(),
    items: [
      {
        kind: "error",
        title: "Error",
        message,
        startLine
      }
    ]
  };
}

function toResultItem(result: OracleExecutionResult, ordinal: number, sourceSql?: string): ExecutionResultItem {
  const statementKind = classifyStatement(sourceSql);
  if (statementKind.kind === "commit") {
    return { kind: "message", title: "Commit", message: "Commit succeeded.", elapsedMs: result.elapsedMs };
  }
  if (statementKind.kind === "rollback") {
    return { kind: "message", title: "Rollback", message: "Rollback succeeded.", elapsedMs: result.elapsedMs };
  }
  if (statementKind.kind === "statement") {
    return {
      kind: "message",
      title: statementKind.title,
      message: `${statementKind.title} succeeded.`,
      elapsedMs: result.elapsedMs
    };
  }

  if (result.type === "query") {
    return {
      kind: "query",
      title: "Query Result",
      columns: result.columns,
      rows: result.rows,
      hasMoreRows: result.hasMoreRows,
      elapsedMs: result.elapsedMs
    };
  }

  return {
    kind: "update",
    title: "Update Count",
    rowsAffected: result.rowsAffected,
    elapsedMs: result.elapsedMs
  };
}

type StatementClassification =
  | { kind: "commit" }
  | { kind: "rollback" }
  | { kind: "statement"; title: string }
  | { kind: "unknown" };

function classifyStatement(sql: string | undefined): StatementClassification {
  const normalized = stripLeadingComments(sql?.trim().replace(/;$/, "").trim() ?? "").toLowerCase();
  if (normalized === "commit") {
    return { kind: "commit" };
  }
  if (normalized === "rollback") {
    return { kind: "rollback" };
  }

  const verb = normalized.match(/^([a-z]+)/)?.[1];
  switch (verb) {
    case "grant":
      return { kind: "statement", title: "Grant" };
    case "revoke":
      return { kind: "statement", title: "Revoke" };
    case "create":
      return { kind: "statement", title: "Create" };
    case "alter":
      return { kind: "statement", title: "Alter" };
    case "drop":
      return { kind: "statement", title: "Drop" };
    case "truncate":
      return { kind: "statement", title: "Truncate" };
    case "comment":
      return { kind: "statement", title: "Comment" };
    case "analyze":
      return { kind: "statement", title: "Analyze" };
    case "begin":
    case "declare":
      return { kind: "statement", title: "PL/SQL Block" };
    default:
      return { kind: "unknown" };
  }
}

function stripLeadingComments(sql: string): string {
  let remaining = sql.trimStart();
  let changed = true;
  while (changed) {
    changed = false;
    if (remaining.startsWith("--")) {
      const newline = remaining.indexOf("\n");
      remaining = newline >= 0 ? remaining.slice(newline + 1).trimStart() : "";
      changed = true;
    } else if (remaining.startsWith("/*")) {
      const end = remaining.indexOf("*/");
      if (end >= 0) {
        remaining = remaining.slice(end + 2).trimStart();
        changed = true;
      }
    }
  }
  return remaining;
}
