import Link from 'next/link';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { TagsClient } from './TagsClient';

export const dynamic = 'force-dynamic';

export default async function TagsPage() {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, slug, created_at')
    .order('name');

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <Link
          href="/app"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Vault
        </Link>
        <h1 className="text-xl font-semibold">Tags</h1>
      </header>
      <main className="mx-auto mt-6 max-w-2xl">
        <TagsClient tags={tags ?? []} />
      </main>
    </div>
  );
}
