import Link from 'next/link';
import { UpgradeButton } from './UpgradeButton';

export const dynamic = 'force-dynamic';

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-center text-2xl font-semibold">Plans</h1>
        <p className="mt-2 text-center text-neutral-600 dark:text-neutral-400">
          Choose the right plan for your needs
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
            <h2 className="text-lg font-semibold">Pro</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              1 seat · Full access
            </p>
            <UpgradeButton plan="pro" className="mt-4" />
          </div>
          <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-700">
            <h2 className="text-lg font-semibold">Team</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              5 seats · Collaborate with your team
            </p>
            <UpgradeButton plan="team" className="mt-4" />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-neutral-500">
          <Link href="/app" className="hover:underline">
            Back to app
          </Link>
        </p>
      </div>
    </div>
  );
}
