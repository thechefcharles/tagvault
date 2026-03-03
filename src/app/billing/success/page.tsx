import Link from 'next/link';
import { ManageBillingButton } from './ManageBillingButton';

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold">You&apos;re now Pro!</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Thank you for upgrading. Your Pro features are now active.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/app"
            className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Go to Vault
          </Link>
          <ManageBillingButton />
        </div>
      </div>
    </div>
  );
}
