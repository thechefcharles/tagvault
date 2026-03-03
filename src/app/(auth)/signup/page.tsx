import Link from 'next/link';
import { SignupForm } from '@/components/SignupForm';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">TagVault</h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">Create your account</p>
        </div>
        <SignupForm />
        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          Already have an account?{' '}
          <Link href="/login" className="font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
