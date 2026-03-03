import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { listItems } from "@/lib/db/items";
import { VaultClient } from "./VaultClient";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const type = params.type as "link" | "file" | "note" | undefined;
  const sort = (params.sort as "recent" | "priority") || "recent";

  const items = await listItems({
    userId: user.id,
    type,
    sort,
  });

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-semibold">Vault</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>
      <nav className="max-w-2xl mx-auto mt-2 flex gap-3 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/search" className="hover:text-foreground">Search</Link>
        <Link href="/saved-searches" className="hover:text-foreground">Saved Searches</Link>
        <Link href="/alerts" className="hover:text-foreground">Alerts</Link>
      </nav>
      <main className="max-w-2xl mx-auto mt-6">
        <VaultClient items={items} />
      </main>
    </div>
  );
}
