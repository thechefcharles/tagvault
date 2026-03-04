'use client';

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type Item = {
  id: string;
  type: string;
  title: string | null;
  description: string;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
};

export function SharedItemView({
  item,
  token,
}: {
  item: Item;
  token: string;
}) {
  async function handleDownload() {
    const res = await fetch(`/api/share-item/${token}/download`);
    const data = await res.json();
    if (res.ok && data.url) {
      window.open(data.url, '_blank');
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <span className="inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-xs capitalize dark:bg-neutral-700">
          {item.type}
        </span>
        <h1 className="mt-2 text-xl font-semibold">
          {item.title || item.description.slice(0, 80)}
          {!item.title && item.description.length > 80 ? '…' : ''}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Shared item · {formatDate(item.created_at)}</p>
      </header>

      {item.type === 'note' && (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
            {item.description}
          </p>
        </div>
      )}

      {item.type === 'link' && item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Open link
        </a>
      )}

      {item.type === 'file' && (
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Download
        </button>
      )}

      {item.type === 'link' && item.description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{item.description}</p>
      )}
    </div>
  );
}
