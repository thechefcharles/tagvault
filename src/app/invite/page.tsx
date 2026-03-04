import Link from 'next/link';
import { getCurrentUser } from '@/lib/server/auth';
import { InviteAcceptClient } from '@/components/InviteAcceptClient';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ token?: string; org?: string }> };

export default async function InvitePage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token?.trim();
  const user = await getCurrentUser();

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow dark:border-neutral-700 dark:bg-neutral-900">
          <h1 className="text-lg font-semibold">Invalid invite link</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            This invite link is missing the token. Ask the person who invited you to send a new link.
          </p>
          <Link
            href="/app"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Go to app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow dark:border-neutral-700 dark:bg-neutral-900">
        <h1 className="text-lg font-semibold">Organization invite</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          You&apos;ve been invited to join an organization.
        </p>
        <InviteAcceptClient token={token} isLoggedIn={!!user} />
      </div>
    </div>
  );
}
