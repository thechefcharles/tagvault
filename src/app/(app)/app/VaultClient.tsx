"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ItemList } from "@/components/ItemList";
import { QuickAddModal } from "@/components/QuickAddModal";
import type { Item } from "@/types/item";

export function VaultClient({ items }: { items: Item[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  function handleQuickAddClose() {
    setModalOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Quick Add
        </button>
      </div>
      <ItemList items={items} />
      <QuickAddModal open={modalOpen} onClose={handleQuickAddClose} />
    </>
  );
}
