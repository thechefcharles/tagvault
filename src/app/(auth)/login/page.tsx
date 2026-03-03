import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">TagVault</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Sign in to your account
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
