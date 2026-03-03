import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getItemById } from "@/lib/db/items";

const EXPIRES_IN = 60; // seconds

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const item = await getItemById({ userId: user.id, id });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (item.type !== "file" || !item.storage_path) {
      return NextResponse.json(
        { error: "Item is not a file or has no storage path" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("vault")
      .createSignedUrl(item.storage_path, EXPIRES_IN);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
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
