export interface TnsAlias {
  alias: string;
  rawDescription: string;
  sourcePath: string;
}

export interface TnsParseResult {
  aliases: TnsAlias[];
  errors: Array<{ sourcePath: string; message: string }>;
}

interface ActiveAlias {
  alias: string;
  lines: string[];
  balance: number;
}

const ALIAS_START = /^\s*([A-Za-z0-9_.-]+)\s*=\s*(.*)$/;

export function parseTnsnames(content: string, sourcePath: string): TnsParseResult {
  const aliases: TnsAlias[] = [];
  const errors: Array<{ sourcePath: string; message: string }> = [];
  let active: ActiveAlias | undefined;

  for (const rawLine of content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    const line = stripComment(rawLine);
    if (line.trim().length === 0) {
      continue;
    }

    const aliasMatch = line.match(ALIAS_START);
    if (aliasMatch) {
      if (active) {
        errors.push({
          sourcePath,
          message: `Alias '${active.alias}' is missing closing parenthesis.`
        });
      }

      const [, alias, rest] = aliasMatch;
      active = {
        alias,
        lines: rest.trim().length > 0 ? [rest] : [],
        balance: parenBalance(rest)
      };

      if (active.lines.length > 0 && active.balance === 0) {
        completeActiveAlias(active, sourcePath, aliases, errors);
        active = undefined;
      }
      continue;
    }

    if (!active) {
      continue;
    }

    active.lines.push(line);
    active.balance += parenBalance(line);

    if (active.balance === 0) {
      completeActiveAlias(active, sourcePath, aliases, errors);
      active = undefined;
    }
  }

  if (active) {
    errors.push({
      sourcePath,
      message: `Alias '${active.alias}' is missing closing parenthesis.`
    });
  }

  return { aliases, errors };
}

function completeActiveAlias(
  active: ActiveAlias,
  sourcePath: string,
  aliases: TnsAlias[],
  errors: Array<{ sourcePath: string; message: string }>
): void {
  const rawDescription = active.lines.join("\n").trim();
  if (!rawDescription.startsWith("(")) {
    errors.push({
      sourcePath,
      message: `Alias '${active.alias}' does not contain a DESCRIPTION expression.`
    });
    return;
  }

  aliases.push({
    alias: active.alias,
    rawDescription,
    sourcePath
  });
}

function stripComment(line: string): string {
  const index = line.indexOf("#");
  return index >= 0 ? line.slice(0, index) : line;
}

function parenBalance(value: string): number {
  let balance = 0;
  for (const char of value) {
    if (char === "(") {
      balance += 1;
    } else if (char === ")") {
      balance -= 1;
    }
  }
  return balance;
}
