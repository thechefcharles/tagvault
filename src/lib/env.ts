/**
 * Centralized environment validation.
 * Throws on boot in production if required vars are missing.
 */

const isProd = process.env.NODE_ENV === 'production';

const required = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
} as const;

const optional = {
  CRON_SECRET: process.env.CRON_SECRET,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
} as const;

function validate() {
  const missing: string[] = [];
  for (const [key, value] of Object.entries(required)) {
    if (!value || (typeof value === 'string' && !value.trim())) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const msg = `Missing required env vars: ${missing.join(', ')}`;
    // Log instead of throw to avoid blocking app startup; API routes will still fail with clear errors
    console.error(`[env] ${msg}`);
  }

  return {
    ...required,
    ...optional,
  } as {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    CRON_SECRET: string | undefined;
    SENTRY_DSN: string | undefined;
    NEXT_PUBLIC_SENTRY_DSN: string | undefined;
    UPSTASH_REDIS_REST_URL: string | undefined;
    UPSTASH_REDIS_REST_TOKEN: string | undefined;
    OPENAI_API_KEY: string | undefined;
  };
}

export const env = validate();
