import { requireUser } from "@/lib/server/auth";
import { LogoutButton } from "@/components/LogoutButton";
import Link from "next/link";
import { SavedSearchesClient } from "./SavedSearchesClient";

export default async function SavedSearchesPage() {
  await requireUser();

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-6">
        <Link
          href="/app"
          className="text-neutral-600 hover:text-foreground dark:text-neutral-400"
        >
          ← Vault
        </Link>
        <LogoutButton />
      </header>
      <main className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold mb-4">Saved Searches</h1>
        <SavedSearchesClient />
      </main>
    </div>
  );
}
