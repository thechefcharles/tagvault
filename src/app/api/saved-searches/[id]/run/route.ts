import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getQueryEmbedding } from "@/lib/embeddings";
import { searchItemsHybrid } from "@/lib/db/search-hybrid";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = await createClient();

    const { data: saved, error } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .single();

    if (error || !saved) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const filters = (saved.filters ?? {}) as { type?: string[] };
    const type = filters.type?.[0] ?? "all";

    let queryEmbedding: number[] | null = null;
    if (saved.semantic_enabled && saved.query?.trim()) {
      queryEmbedding = await getQueryEmbedding(saved.query);
    }

    const items = await searchItemsHybrid({
      userId: user.id,
      q: saved.query ?? "",
      type: type as "link" | "file" | "note" | "all",
      sort: saved.sort ?? "best_match",
      limit: 50,
      offset: 0,
      useSemantic: saved.semantic_enabled,
      queryEmbedding,
    });

    return NextResponse.json(items);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
