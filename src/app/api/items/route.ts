import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { listItems, createItem } from "@/lib/db/items";
import { createItemSchema } from "@/lib/db/validators";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "link" | "file" | "note" | null;
    const sort = (searchParams.get("sort") as "recent" | "priority") ?? "recent";

    const items = await listItems({
      userId: user.id,
      type: type ?? undefined,
      sort,
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

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.type === "file") {
      return NextResponse.json(
        { error: "Use /api/items/upload for file items" },
        { status: 400 }
      );
    }

    const item = await createItem({
      userId: user.id,
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
