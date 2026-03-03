"use client";

import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="px-4 py-2 border border-neutral-300 rounded-md hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
    >
      Log out
    </button>
  );
}
