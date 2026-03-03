import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { getQueryEmbedding } from "@/lib/embeddings";
import { searchItemsHybrid } from "@/lib/db/search-hybrid";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().optional().default(""),
  type: z.enum(["link", "file", "note", "all"]).optional().default("all"),
  sort: z.enum(["best_match", "priority", "recent"]).optional().default("best_match"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  semantic: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const parsed = searchQuerySchema.safeParse({
      q: searchParams.get("q") ?? "",
      type: searchParams.get("type") ?? "all",
      sort: searchParams.get("sort") ?? "best_match",
      limit: searchParams.get("limit") ?? 50,
      offset: searchParams.get("offset") ?? 0,
      semantic: searchParams.get("semantic") ?? "true",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid params", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { q, type, sort, limit, offset, semantic } = parsed.data;
    let queryEmbedding: number[] | null = null;

    if (semantic && q.trim()) {
      queryEmbedding = await getQueryEmbedding(q);
    }

    const items = await searchItemsHybrid({
      userId: user.id,
      q,
      type,
      sort,
      limit,
      offset,
      useSemantic: semantic,
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
