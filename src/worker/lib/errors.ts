import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@/shared/api";

/**
 * Throw AppError from any route, service or tool. The global handler turns it
 * into `{ error: { code, message, issues? } }` with the right status.
 */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly issues?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, issues?: Record<string, string>) => new AppError(400, "bad_request", message, issues);
export const unauthorized = (message = "Sign in to continue.") => new AppError(401, "unauthorized", message);
export const forbidden = (message = "You do not have access to this action.") => new AppError(403, "forbidden", message);
export const notFound = (what = "Record") => new AppError(404, "not_found", `${what} was not found.`);
export const conflict = (message: string) => new AppError(409, "conflict", message);
export const tooManyRequests = (message = "Too many attempts. Wait a few minutes and try again.") => new AppError(429, "rate_limited", message);

export function zodIssues(error: ZodError): Record<string, string> {
  const issues: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    issues[path] ??= issue.message;
  }
  return issues;
}

export function toErrorBody(error: unknown): { status: ContentfulStatusCode; body: ApiErrorBody } {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message, issues: error.issues } } };
  }
  if (error instanceof ZodError) {
    return { status: 422, body: { error: { code: "validation_failed", message: "Check the highlighted fields.", issues: zodIssues(error) } } };
  }
  if (error instanceof HTTPException) {
    return { status: error.status as ContentfulStatusCode, body: { error: { code: "http_error", message: error.message } } };
  }
  return { status: 500, body: { error: { code: "internal_error", message: "Something went wrong on our side. Try again." } } };
}

export function handleError(error: unknown, c: Context): Response {
  const { status, body } = toErrorBody(error);
  if (status >= 500) console.error("[sistemele] unhandled error", error);
  return c.json(body, status);
}
