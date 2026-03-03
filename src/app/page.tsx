import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-semibold">TagVault</h1>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-md">
          Store and organize your items with priority and timestamps.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
