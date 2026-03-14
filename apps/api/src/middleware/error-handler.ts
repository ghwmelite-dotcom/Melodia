import type { ErrorCode } from "@melodia/shared";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Env, Variables } from "../types.js";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

const STATUS_MAP: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
};

export function errorResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  code: ErrorCode,
  message: string
) {
  return c.json(
    { success: false, error: { code, message } },
    (STATUS_MAP[code] ?? 500) as ContentfulStatusCode
  );
}

export function errorHandler() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: () => Promise<void>
  ) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(c, err.code, err.message);
      }
      console.error("Unhandled error:", err);
      return errorResponse(c, "INTERNAL_ERROR", "An unexpected error occurred");
    }
  };
}
