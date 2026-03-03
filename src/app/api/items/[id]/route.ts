import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getItemById,
  updateItem,
  deleteItem,
} from "@/lib/db/items";
import { updateItemSchema } from "@/lib/db/validators";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "1";

    const item = await getItemById({ userId: user.id, id });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (download && item.type === "file" && item.storage_path) {
      const supabase = await createClient();
      const { data: urlData, error } = await supabase.storage
        .from("vault")
        .createSignedUrl(item.storage_path, 60);

      if (!error && urlData?.signedUrl) {
        return NextResponse.redirect(urlData.signedUrl);
      }
    }

    return NextResponse.json(item);
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await updateItem({
      userId: user.id,
      id,
      payload: parsed.data,
    });
    return NextResponse.json(item);
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

export async function DELETE(
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

    if (item.storage_path) {
      const supabase = await createClient();
      await supabase.storage.from("vault").remove([item.storage_path]);
    }

    await deleteItem({ userId: user.id, id });
    return NextResponse.json({ ok: true });
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
