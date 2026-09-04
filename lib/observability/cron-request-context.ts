import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/http/api-error";
import {
  createRequestLogger,
  type StructuredLogger,
} from "@/lib/observability/structured-logger";

type CronResponseOptions = {
  status?: number;
  fields?: Record<string, unknown>;
};

type CronFailureOptions = CronResponseOptions & {
  event?: string;
};

export type CronRequestContext = {
  authorized: boolean;
  logger: StructuredLogger;
  deny: () => NextResponse;
  complete: (
    body: Record<string, unknown>,
    options?: CronResponseOptions,
  ) => NextResponse;
  fail: (
    userMessage: string,
    error: unknown,
    options?: CronFailureOptions,
  ) => NextResponse;
};

export function createCronRequestContext(
  request: NextRequest,
  component: string,
): CronRequestContext {
  const startedAt = Date.now();
  const logger = createRequestLogger(request, component);
  const secret = process.env.CRON_SECRET;
  const authorized =
    Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  const authState = secret ? "invalid" : "not_configured";

  return {
    authorized,
    logger,
    deny: () => {
      logger.warn("cron.authorization_denied", { status: 403, authState });
      return logger.withResponse(
        NextResponse.json(
          { error: secret ? "Forbidden" : "CRON_SECRET no configurado" },
          { status: 403 },
        ),
      );
    },
    complete: (body, options = {}) => {
      const status = options.status ?? 200;
      logger.info("cron.completed", {
        status,
        durationMs: Date.now() - startedAt,
        ...options.fields,
      });
      return logger.withResponse(NextResponse.json(body, { status }));
    },
    fail: (userMessage, error, options = {}) => {
      const status = options.status ?? 500;
      return logger.withResponse(
        apiError(userMessage, error, status, component, {
          logger,
          event: options.event ?? "cron.run_failed",
          fields: {
            durationMs: Date.now() - startedAt,
            ...options.fields,
          },
        }),
      );
    },
  };
}
