type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const SAFE_ERROR_CODE_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const SAFE_ERROR_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;

const SENSITIVE_FIELD_PATTERN =
  /(authorization|cookie|token|secret|password|api.?key|email|phone|address|body|payload|query|url|path|name)/i;

const SAFE_FIELDS = new Set([
  "attempts",
  "authState",
  "batchSize",
  "cappedAt",
  "configured",
  "deleted",
  "deletedBeforeFailure",
  "deletedPinAttempts",
  "deletedPortalThrottle",
  "durationMs",
  "method",
  "minAgeDays",
  "mode",
  "operation",
  "orphans",
  "referenced",
  "retryable",
  "scanned",
  "skippedNoDate",
  "skippedTooNew",
  "stage",
  "status",
]);

type SafeLogValue = string | number | boolean | null;

type SafeError = {
  name: string;
  code?: string;
};

export type StructuredLogger = {
  requestId: string;
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields) => void;
  error: (event: string, fields?: LogFields) => void;
  withResponse: <T extends Response>(response: T) => T;
};

function checkedIdentifier(value: string, label: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${label} inválido para log estructurado`);
  }
  return value;
}

function requestIdFrom(request: Request): string {
  const provided =
    request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id");
  return provided && REQUEST_ID_PATTERN.test(provided)
    ? provided
    : crypto.randomUUID();
}

function safeError(value: unknown): SafeError {
  if (value instanceof Error) {
    const code = (value as Error & { code?: unknown }).code;
    return {
      name: SAFE_ERROR_NAME_PATTERN.test(value.name) ? value.name : "Error",
      ...(typeof code === "string" && SAFE_ERROR_CODE_PATTERN.test(code)
        ? { code }
        : {}),
    };
  }

  if (value && typeof value === "object") {
    const candidate = value as { code?: unknown };
    return {
      name: "Object",
      ...(typeof candidate.code === "string" &&
      SAFE_ERROR_CODE_PATTERN.test(candidate.code)
        ? { code: candidate.code }
        : {}),
    };
  }

  return { name: "Unknown" };
}

function safeScalar(value: unknown): SafeLogValue | undefined {
  if (value === null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  // Los campos permitidos son etiquetas operativas, no texto libre.
  if (!SAFE_LABEL_PATTERN.test(value)) {
    return "[REDACTED]";
  }
  return value;
}

function sanitizeFields(fields: LogFields): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      safe[key] = "[REDACTED]";
      continue;
    }
    if (key === "error") {
      safe.error = safeError(value);
      continue;
    }
    if (!SAFE_FIELDS.has(key)) continue;
    const scalar = safeScalar(value);
    if (scalar !== undefined) safe[key] = scalar;
  }
  return safe;
}

export function createRequestLogger(
  request: Request,
  component: string,
): StructuredLogger {
  const stableComponent = checkedIdentifier(component, "component");
  const requestId = requestIdFrom(request);

  function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      event: checkedIdentifier(event, "event"),
      component: stableComponent,
      requestId,
      ...sanitizeFields(fields),
    };
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.info(line);
  }

  return {
    requestId,
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    withResponse: <T extends Response>(response: T): T => {
      response.headers.set("x-request-id", requestId);
      return response;
    },
  };
}
