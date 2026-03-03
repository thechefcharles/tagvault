import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

const MODEL = process.env.OPENAI_EMBEDDINGS_MODEL ?? "text-embedding-3-small";

export async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;

  const trimmed = query.trim().slice(0, 8000);
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data: cached } = await supabase
    .from("search_queries")
    .select("embedding")
    .eq("query", trimmed)
    .single();

  if (cached?.embedding && Array.isArray(cached.embedding)) {
    return cached.embedding as number[];
  }

  const openai = new OpenAI({ apiKey: key });
  const resp = await openai.embeddings.create({
    model: MODEL,
    input: trimmed,
  });

  const embedding = resp.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) return null;

  await supabase
    .from("search_queries")
    .upsert(
      { query: trimmed, embedding, created_at: new Date().toISOString() },
      { onConflict: "query" }
    );

  return embedding;
}
