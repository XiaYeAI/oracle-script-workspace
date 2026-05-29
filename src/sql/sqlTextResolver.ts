import { splitOracleScript } from "./sqlSplitter";

export interface SqlTextResolution {
  sql: string;
  source: "selection" | "currentStatement" | "script";
  startLine: number;
}

interface StatementWithRange {
  sql: string;
  startLine: number;
  startOffset: number;
  endOffset: number;
}

export function resolveCurrentOrSelectedSql(
  documentText: string,
  selectionStart: number,
  selectionEnd: number
): SqlTextResolution {
  if (selectionEnd > selectionStart) {
    const selectedText = documentText.slice(selectionStart, selectionEnd).trim();
    return {
      sql: normalizeExecutableSql(selectedText),
      source: "selection",
      startLine: lineNumberAtOffset(documentText, selectionStart)
    };
  }

  const statements = splitWithRanges(documentText);
  const current =
    statements.find(
      (statement) => selectionStart >= statement.startOffset && selectionStart <= statement.endOffset
    ) ?? statements[0];

  if (!current) {
    return { sql: "", source: "currentStatement", startLine: 1 };
  }

  return {
    sql: current.sql,
    source: "currentStatement",
    startLine: current.startLine
  };
}

export function resolveScriptSql(documentText: string): SqlTextResolution {
  return {
    sql: documentText,
    source: "script",
    startLine: 1
  };
}

function normalizeExecutableSql(sql: string): string {
  const statements = splitOracleScript(sql);
  return statements.length === 1 ? statements[0].sql : sql;
}

function splitWithRanges(documentText: string): StatementWithRange[] {
  return splitOracleScript(documentText).map((statement) => {
    const startOffset = offsetAtLine(documentText, statement.startLine);
    const statementOffset = documentText.indexOf(statement.sql, startOffset);
    const resolvedStart = statementOffset >= 0 ? statementOffset : startOffset;

    return {
      ...statement,
      startOffset: resolvedStart,
      endOffset: resolvedStart + statement.sql.length
    };
  });
}

function lineNumberAtOffset(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < Math.min(offset, text.length); index += 1) {
    if (text[index] === "\n") {
      line += 1;
    }
  }
  return line;
}

function offsetAtLine(text: string, lineNumber: number): number {
  if (lineNumber <= 1) {
    return 0;
  }

  let line = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      if (line === lineNumber) {
        return index + 1;
      }
    }
  }

  return text.length;
}
