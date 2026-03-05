import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/server/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminIndexPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      <header className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold">Admin</h1>
      </header>
      <main className="mx-auto mt-8 max-w-4xl space-y-4">
        <ul className="space-y-2">
          <li>
            <Link
              href="/admin/billing"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Billing
            </Link>
          </li>
          <li>
            <Link
              href="/admin/users"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Users
            </Link>
          </li>
          <li>
            <Link
              href="/admin/mobile"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Mobile (TestFlight sanity)
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
