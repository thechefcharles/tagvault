import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { runSavedSearch } from "@/lib/alerts/run-saved-search";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = await createClient();

    const { data: alert, error: errAlert } = await supabase
      .from("alerts")
      .select("id, owner_user_id, saved_search_id, name, notify_on_new")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .single();

    if (errAlert || !alert) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ownerId = alert.owner_user_id as string;
    const { data: saved, error: errSaved } = await supabase
      .from("saved_searches")
      .select("id, query, filters, sort, semantic_enabled")
      .eq("id", alert.saved_search_id)
      .single();

    if (errSaved || !saved) {
      return NextResponse.json(
        { error: "Saved search not found" },
        { status: 404 }
      );
    }

    const items = await runSavedSearch(
      saved as { id: string; query: string; filters: Record<string, unknown>; sort: string; semantic_enabled: boolean },
      ownerId
    );

    const itemIds = items.map((i) => i.id);
    let newMatchCount = 0;

    if (alert.notify_on_new && itemIds.length > 0) {
      const { data: existing } = await supabase
        .from("alert_item_state")
        .select("item_id")
        .eq("alert_id", alert.id)
        .in("item_id", itemIds);

      const seen = new Set((existing ?? []).map((r) => r.item_id as string));
      const newIds = itemIds.filter((id) => !seen.has(id));
      newMatchCount = newIds.length;

      if (newIds.length > 0) {
        await supabase.from("alert_item_state").insert(
          newIds.map((item_id) => ({
            alert_id: alert.id,
            item_id,
          }))
        );

        await supabase.from("notifications").insert({
          owner_user_id: ownerId,
          org_id: null,
          type: "alert_new_matches",
          title: `New matches for: ${alert.name}`,
          body: `${newMatchCount} new item${newMatchCount === 1 ? "" : "s"} matched your saved search.`,
          meta: {
            alert_id: alert.id,
            saved_search_id: alert.saved_search_id,
            item_ids: newIds.slice(0, 50),
          },
        });
      }
    }

    const now = new Date().toISOString();
    const nextRun = new Date();
    const { data: freq } = await supabase
      .from("alerts")
      .select("frequency_minutes")
      .eq("id", alert.id)
      .single();
    const mins = (freq?.frequency_minutes as number) ?? 60;
    nextRun.setMinutes(nextRun.getMinutes() + mins);

    await supabase
      .from("alerts")
      .update({ last_run_at: now, next_run_at: nextRun.toISOString() })
      .eq("id", alert.id);

    await supabase.from("alert_runs").insert({
      alert_id: alert.id,
      status: "success",
      new_match_count: newMatchCount,
    });

    return NextResponse.json({
      ok: true,
      total_matches: itemIds.length,
      new_matches: newMatchCount,
      notified: newMatchCount > 0,
    });
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
