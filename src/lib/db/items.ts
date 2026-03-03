import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/types/item";
import type { CreateItemInput, UpdateItemInput } from "@/lib/db/validators";

export async function listItems({
  userId,
  type,
  sort = "recent",
}: {
  userId: string;
  type?: "link" | "file" | "note";
  sort?: "recent" | "priority";
}): Promise<Item[]> {
  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) throw error;

  let items = (data ?? []) as Item[];
  if (sort === "priority") {
    items = [...items].sort((a, b) => {
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      return pa - pb;
    });
  }
  return items;
}

export async function getItemById({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<Item | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Item;
}

export async function createItem({
  userId,
  payload,
}: {
  userId: string;
  payload: CreateItemInput;
}): Promise<Item> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert({
      user_id: userId,
      type: payload.type,
      title: payload.title ?? null,
      description: payload.description,
      priority: payload.priority ?? null,
      url: payload.type === "link" ? payload.url ?? null : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Item;
}

export async function updateItem({
  userId,
  id,
  payload,
}: {
  userId: string;
  id: string;
  payload: UpdateItemInput;
}): Promise<Item> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.priority !== undefined) update.priority = payload.priority;
  if (payload.url !== undefined) update.url = payload.url;

  const { data, error } = await supabase
    .from("items")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Item not found");
  return data as Item;
}

export async function deleteItem({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function attachFileToItem({
  userId,
  id,
  storage_path,
  mime_type,
  title,
}: {
  userId: string;
  id: string;
  storage_path: string;
  mime_type: string;
  title?: string | null;
}): Promise<Item> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    storage_path,
    mime_type,
  };
  if (title !== undefined) update.title = title;

  const { data, error } = await supabase
    .from("items")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Item not found");
  return data as Item;
}
