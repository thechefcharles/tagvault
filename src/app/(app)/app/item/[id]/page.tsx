import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { getItemById } from "@/lib/db/items";
import { ItemDetailClient } from "./ItemDetailClient";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const item = await getItemById({ userId: user.id, id });
  if (!item) notFound();

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto flex items-center gap-4 mb-6">
        <Link
          href="/app"
          className="text-neutral-600 hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← Back
        </Link>
        <span className="text-sm px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 capitalize">
          {item.type}
        </span>
      </header>
      <main className="max-w-2xl mx-auto">
        <ItemDetailClient item={item} />
      </main>
    </div>
  );
}
