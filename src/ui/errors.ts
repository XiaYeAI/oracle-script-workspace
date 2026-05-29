export interface SafeOracleError {
  code?: string;
  message: string;
  safeDetails: string;
}

export function formatOracleError(error: unknown): SafeOracleError {
  const rawMessage = getErrorMessage(error);
  const code = rawMessage.match(/\bORA-\d{5}\b/)?.[0];
  const message = code ? `${code}: ${stripPassword(rawMessage)}` : stripPassword(rawMessage);

  return {
    code,
    message,
    safeDetails: message
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown Oracle error";
}

function stripPassword(value: string): string {
  return value
    .replace(/password\s*=\s*[^)\s;]+/gi, "password=<redacted>")
    .replace(/pwd\s*=\s*[^)\s;]+/gi, "pwd=<redacted>")
    .replace(/secret-password/gi, "<redacted>");
}
