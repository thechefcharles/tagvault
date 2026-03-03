export type ItemType = "link" | "file" | "note";

export type Item = {
  id: string;
  user_id: string;
  type: ItemType;
  title: string | null;
  description: string;
  priority: number | null;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
};
