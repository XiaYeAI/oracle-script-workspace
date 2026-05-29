export interface ObjectNameResolution {
  owner?: string;
  objectName: string;
}

const TOKEN_PATTERN = /[A-Za-z_][A-Za-z0-9_$#]*(?:\.[A-Za-z_][A-Za-z0-9_$#]*)?/g;

export function resolveObjectNameAt(
  documentText: string,
  selectionStart: number,
  selectionEnd: number
): ObjectNameResolution | undefined {
  const selectedText = documentText.slice(selectionStart, selectionEnd).trim();
  if (selectedText.length > 0) {
    return parseObjectName(selectedText);
  }

  for (const match of documentText.matchAll(TOKEN_PATTERN)) {
    const tokenStart = match.index ?? 0;
    const tokenEnd = tokenStart + match[0].length;
    if (selectionStart >= tokenStart && selectionStart <= tokenEnd) {
      return parseObjectName(match[0]);
    }
  }

  return undefined;
}

function parseObjectName(value: string): ObjectNameResolution | undefined {
  const cleaned = value.replace(/"/g, "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_$#]*(?:\.[A-Za-z_][A-Za-z0-9_$#]*)?$/.test(cleaned)) {
    return undefined;
  }

  const [first, second] = cleaned.split(".");
  if (second) {
    return { owner: first.toUpperCase(), objectName: second.toUpperCase() };
  }

  return { objectName: first.toUpperCase() };
}
