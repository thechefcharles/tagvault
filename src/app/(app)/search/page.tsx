import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { LogoutButton } from "@/components/LogoutButton";
import Link from "next/link";
import { SearchClient } from "./SearchClient";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/app" className="text-neutral-600 hover:text-foreground dark:text-neutral-400">
            ← Vault
          </Link>
          <Link href="/saved-searches" className="text-sm text-neutral-600 hover:text-foreground dark:text-neutral-400">
            Saved Searches
          </Link>
        </div>
        <LogoutButton />
      </header>
      <main className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold mb-4">Search</h1>
        <SearchClient />
      </main>
    </div>
  );
}
