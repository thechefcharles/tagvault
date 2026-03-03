/**
 * Structured API logging for Vercel / JSON logs.
 * Do NOT log secrets, full bodies, or PII.
 */

export type ApiLogParams = {
  requestId: string;
  userId?: string | null;
  path: string;
  method: string;
  status: number;
  ms: number;
  errorCode?: string;
};

export function logApi(params: ApiLogParams): void {
  const { requestId, userId, path, method, status, ms, errorCode } = params;
  const entry: Record<string, unknown> = {
    type: 'api',
    requestId,
    path,
    method,
    status,
    ms,
  };
  if (userId) entry.userId = userId;
  if (errorCode) entry.errorCode = errorCode;
  console.log(JSON.stringify(entry));
}
