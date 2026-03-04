# Phase 10B Verification

Manual steps and curl examples to confirm rate limiting and cron locks.

## Prerequisites

- App running locally (`npm run dev`) or on a deployed URL
- Valid auth session (cookie or token) for protected routes
- Redis env vars set for real rate limiting

## 1. 429 After N Requests

**Search (60/min):**

```bash
# Replace COOKIE with your session cookie, HOST with base URL
for i in {1..65}; do
  curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: sb-...=COOKIE" "https://HOST/api/search?q=test"
done
```

Expect 429 on requests 61–65.

**Items POST (30/min):**

```bash
for i in {1..35}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    -H "Cookie: sb-...=COOKIE" \
    -H "Content-Type: application/json" \
    -d '{"type":"note","description":"test"}' \
    "https://HOST/api/items"
done
```

Expect 429 on requests 31–35.

## 2. Headers Present

```bash
curl -s -D - -X POST \
  -H "Cookie: sb-...=COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"type":"note","description":"test"}' \
  "https://HOST/api/items"
# Repeat 31 times, then inspect the 429 response headers
```

Expect: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## 3. Cron Lock Prevents Concurrent Runs

```bash
# First request (should process or return { processed: 0 })
curl -s -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "https://HOST/api/alerts/process-due"

# Immediate second request (should skip)
curl -s -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "https://HOST/api/alerts/process-due"
```

Second response: `{ "ok": true, "skipped": "lock_not_acquired" }`.

## 4. Permissive Fallback (No Redis)

1. Unset `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local`
2. Restart the app
3. Send 65+ requests to /api/search; none should return 429
4. App should not crash; console may show one-time warning about Redis
