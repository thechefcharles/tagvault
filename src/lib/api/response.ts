import { NextResponse } from 'next/server';
import type { SentryContext } from '@/lib/observability/sentry';
import { captureMessage } from '@/lib/observability/sentry';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export function apiOk<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

/** Build Sentry context from request and optional user/billing. Use when calling apiError with context. */
export function buildApiContext(
  request: Request,
  user?: { id: string } | null,
  billing?: { plan?: string; status?: string | null } | null,
): SentryContext {
  const url = request.url;
  const path = typeof url === 'string' ? new URL(url).pathname : '/';
  return {
    requestId: request.headers.get('x-request-id') ?? undefined,
    route: path,
    method: request.method,
    userId: user?.id,
    plan: billing?.plan,
    billingStatus: billing?.status ?? undefined,
  };
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  status = 400,
  context?: SentryContext,
): NextResponse {
  if (context) {
    captureMessage(`API Error: ${code} - ${message}`, 'error', {
      ...context,
      code,
      status,
      details: details != null ? String(details) : undefined,
    });
  }
  return NextResponse.json(
    { ok: false, error: { code, message, details: details ?? null } },
    { status },
  );
}

export async function parseJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
