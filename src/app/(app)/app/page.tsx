import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { searchItemsHybrid } from "@/lib/db/search-hybrid";
import { VaultClient } from "./VaultClient";

export default async function AppPage() {
  const user = await requireUser();
  const initialItems = await searchItemsHybrid({
    userId: user.id,
    q: "",
    type: "all",
    sort: "best_match",
    queryEmbedding: null,
  });

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Vault</h1>
          <Link href="/search" className="text-sm text-neutral-600 hover:text-foreground dark:text-neutral-400">
            Search
          </Link>
        </div>
        <LogoutButton />
      </header>
      <main className="max-w-2xl mx-auto mt-6">
        <VaultClient initialItems={initialItems} />
      </main>
    </div>
  );
}
