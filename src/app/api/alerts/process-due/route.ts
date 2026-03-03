import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSavedSearch } from "@/lib/alerts/run-saved-search";

const DEFAULT_LIMIT = 25;

export async function POST(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || cronSecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: dueAlerts, error: errAlerts } = await supabase
    .from("alerts")
    .select("id, owner_user_id, saved_search_id, name, frequency_minutes, notify_on_new")
    .eq("enabled", true)
    .not("owner_user_id", "is", null)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(DEFAULT_LIMIT);

  if (errAlerts) {
    console.error("process-due: fetch alerts error", errAlerts);
    return NextResponse.json(
      { error: "Failed to fetch due alerts" },
      { status: 500 }
    );
  }

  if (!dueAlerts?.length) {
    return NextResponse.json({ processed: 0, notified: 0 });
  }

  let processed = 0;
  let totalNotified = 0;

  for (const alert of dueAlerts) {
    const ownerId = alert.owner_user_id as string;
    if (!ownerId) continue;

    let runStatus: "success" | "error" = "success";
    let newMatchCount = 0;
    let runError: string | null = null;

    try {
      const { data: saved, error: errSaved } = await supabase
        .from("saved_searches")
        .select("id, query, filters, sort, semantic_enabled")
        .eq("id", alert.saved_search_id)
        .single();

      if (errSaved || !saved) {
        runStatus = "error";
        runError = "Saved search not found";
      } else {
        const items = await runSavedSearch(
          saved as { id: string; query: string; filters: Record<string, unknown>; sort: string; semantic_enabled: boolean },
          ownerId,
          supabase
        );

        const itemIds = items.map((i) => i.id);
        if (itemIds.length === 0) {
          // no matches, still record run
        } else if (alert.notify_on_new) {
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

            const meta: Record<string, unknown> = {
              alert_id: alert.id,
              saved_search_id: alert.saved_search_id,
              item_ids: newIds.slice(0, 50),
            };

            await supabase.from("notifications").insert({
              owner_user_id: ownerId,
              org_id: null,
              type: "alert_new_matches",
              title: `New matches for: ${alert.name}`,
              body: `${newMatchCount} new item${newMatchCount === 1 ? "" : "s"} matched your saved search.`,
              meta,
            });
            totalNotified += 1;
          }
        }
      }
    } catch (e) {
      runStatus = "error";
      runError = e instanceof Error ? e.message : "Unknown error";
    }

    await supabase.from("alert_runs").insert({
      alert_id: alert.id,
      status: runStatus,
      new_match_count: newMatchCount,
      error: runError,
    });

    const nextRun = new Date();
    nextRun.setMinutes(nextRun.getMinutes() + (alert.frequency_minutes ?? 60));

    await supabase
      .from("alerts")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun.toISOString(),
      })
      .eq("id", alert.id);

    processed += 1;
  }

  return NextResponse.json({ processed, notified: totalNotified });
}
