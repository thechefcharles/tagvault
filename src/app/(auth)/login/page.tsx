import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = params.next ? decodeURIComponent(params.next) : undefined;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">TagVault</h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">Sign in to your account</p>
        </div>
        <LoginForm next={next} />
        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
