import { requireUser } from "@/lib/server/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AppPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-semibold">TagVault</h1>
        <LogoutButton />
      </header>
      <main className="max-w-2xl mx-auto mt-12">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-medium mb-2">Welcome</h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm">
            You are signed in as{" "}
            <span className="font-mono font-medium text-foreground">
              {user.email}
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
