import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/server/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const APP_URL = 'https://tagvault-phi.vercel.app';
const HEALTH_URL = `${APP_URL}/api/health`;

export default async function AdminMobilePage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      <header className="mx-auto max-w-4xl">
        <Link
          href="/admin"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to Admin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">TestFlight Sanity Checklist</h1>
      </header>
      <main className="mx-auto mt-8 max-w-4xl space-y-6">
        <section>
          <h2 className="text-lg font-medium">Current app URL</h2>
          <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
            {APP_URL}
          </p>
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Open in new tab
          </a>
        </section>

        <section>
          <h2 className="text-lg font-medium">Health endpoint</h2>
          <a
            href={HEALTH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {HEALTH_URL}
          </a>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">6-point tester checklist</h2>
          <ol className="list-inside list-decimal space-y-3 text-sm">
            <li>
              <Link
                href="/auth/callback"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                /auth/callback
              </Link>
              <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                (Supabase redirects here after magic link; do not open manually — verify login flow)
              </span>
            </li>
            <li>
              <Link
                href="/onboarding"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                /onboarding
              </Link>
            </li>
            <li>
              <Link
                href="/app"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                /app
              </Link>
            </li>
            <li>
              <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">
                /share/[token]
              </code>
              <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                — replace [token] with a real collection share token; open in app to verify public share
              </span>
            </li>
            <li>
              <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">
                /share-item/[token]
              </code>
              <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                — replace [token] with a real item share token; open in app to verify public share
              </span>
            </li>
            <li>
              Health endpoint returns version and passes DB check (see link above).
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
