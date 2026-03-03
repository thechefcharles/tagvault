import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";
import { SavedSearchViewClient } from "./SavedSearchViewClient";

export default async function SavedSearchViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .single();

  if (error || !saved) notFound();

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-6">
        <Link
          href="/saved-searches"
          className="text-neutral-600 hover:text-foreground dark:text-neutral-400"
        >
          ← Saved Searches
        </Link>
        <LogoutButton />
      </header>
      <main className="max-w-2xl mx-auto">
        <SavedSearchViewClient saved={saved} />
      </main>
    </div>
  );
}
