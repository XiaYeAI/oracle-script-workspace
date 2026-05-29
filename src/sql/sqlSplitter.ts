export interface SqlStatement {
  sql: string;
  startLine: number;
}

interface StatementBuffer {
  text: string;
  startLine: number;
}

export function splitOracleScript(script: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  const buffer: StatementBuffer = { text: "", startLine: 1 };
  const lines = script.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBlockComment = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;

    if (!inSingleQuote && !inDoubleQuote && !inBlockComment && line.trim() === "/") {
      pushStatement(statements, buffer);
      continue;
    }

    let inLineComment = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (buffer.text.trim().length === 0 && char.trim().length > 0) {
        buffer.startLine = lineNumber;
      }

      if (inLineComment) {
        buffer.text += char;
        continue;
      }

      if (inBlockComment) {
        buffer.text += char;
        if (char === "*" && next === "/") {
          buffer.text += next;
          index += 1;
          inBlockComment = false;
        }
        continue;
      }

      if (inSingleQuote) {
        buffer.text += char;
        if (char === "'" && next === "'") {
          buffer.text += next;
          index += 1;
        } else if (char === "'") {
          inSingleQuote = false;
        }
        continue;
      }

      if (inDoubleQuote) {
        buffer.text += char;
        if (char === '"') {
          inDoubleQuote = false;
        }
        continue;
      }

      if (char === "-" && next === "-") {
        buffer.text += char;
        buffer.text += next;
        index += 1;
        inLineComment = true;
        continue;
      }

      if (char === "/" && next === "*") {
        buffer.text += char;
        buffer.text += next;
        index += 1;
        inBlockComment = true;
        continue;
      }

      if (char === "'") {
        buffer.text += char;
        inSingleQuote = true;
        continue;
      }

      if (char === '"') {
        buffer.text += char;
        inDoubleQuote = true;
        continue;
      }

      if (char === ";" && !isPlsqlStatement(buffer.text)) {
        pushStatement(statements, buffer);
        continue;
      }

      buffer.text += char;
    }

    buffer.text += "\n";
  }

  pushStatement(statements, buffer);

  return statements;
}

function pushStatement(statements: SqlStatement[], buffer: StatementBuffer): void {
  const sql = buffer.text.trim();
  if (sql.length > 0) {
    statements.push({ sql, startLine: buffer.startLine });
  }

  buffer.text = "";
  buffer.startLine = 1;
}

function isPlsqlStatement(statementPrefix: string): boolean {
  const normalized = statementPrefix.trimStart().toLowerCase().replace(/\s+/g, " ");

  return (
    normalized.startsWith("begin") ||
    normalized.startsWith("declare") ||
    normalized.startsWith("create or replace package") ||
    normalized.startsWith("create package") ||
    normalized.startsWith("create or replace procedure") ||
    normalized.startsWith("create procedure") ||
    normalized.startsWith("create or replace function") ||
    normalized.startsWith("create function") ||
    normalized.startsWith("create or replace trigger") ||
    normalized.startsWith("create trigger")
  );
}
