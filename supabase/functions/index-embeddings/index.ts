import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BATCH_SIZE = parseInt(Deno.env.get('BATCH_SIZE') ?? '25', 10);
const MODEL = Deno.env.get('OPENAI_EMBEDDINGS_MODEL') ?? 'text-embedding-3-small';
const LOCK_TIMEOUT_MINUTES = 5;

interface QueueRow {
  id: number;
  item_id: string;
}

interface ItemRow {
  id: string;
  title: string | null;
  description: string;
}

Deno.serve(async (req: Request) => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Supabase credentials not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const lockTimeout = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000).toISOString();
  const instanceId = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    const { data: queueRows, error: fetchError } = await supabase
      .from('embedding_queue')
      .select('id, item_id')
      .is('processed_at', null)
      .or(`locked_at.is.null,locked_at.lt.${lockTimeout}`)
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('fetchError', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rows = (queueRows ?? []) as QueueRow[];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No items in queue' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    for (const row of rows) {
      const { error: lockError } = await supabase
        .from('embedding_queue')
        .update({
          locked_at: new Date().toISOString(),
          locked_by: instanceId,
        })
        .eq('id', row.id);

      if (lockError) continue;

      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('id, title, description')
        .eq('id', row.item_id)
        .single();

      if (itemError || !item) {
        await supabase
          .from('embedding_queue')
          .update({
            locked_at: null,
            locked_by: null,
            attempt_count: supabase.sql`attempt_count + 1`,
            last_error: itemError?.message ?? 'Item not found',
            processed_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        continue;
      }

      const textToEmbed = [(item as ItemRow).title ?? '', (item as ItemRow).description ?? '']
        .filter(Boolean)
        .join(' ')
        .slice(0, 8000);

      let embedding: number[];
      try {
        const resp = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: textToEmbed || ' ',
            model: MODEL,
          }),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`OpenAI ${resp.status}: ${errBody}`);
        }

        const json = await resp.json();
        embedding = json.data?.[0]?.embedding;
        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('Invalid embedding response');
        }
      } catch (embErr) {
        const msg = embErr instanceof Error ? embErr.message : String(embErr);
        const { data: qr } = await supabase
          .from('embedding_queue')
          .select('attempt_count')
          .eq('id', row.id)
          .single();
        await supabase
          .from('embedding_queue')
          .update({
            locked_at: null,
            locked_by: null,
            attempt_count: ((qr as { attempt_count: number })?.attempt_count ?? 0) + 1,
            last_error: msg,
          })
          .eq('id', row.id);

        await supabase
          .from('items')
          .update({
            embedding_error: msg,
            embedding_error_at: new Date().toISOString(),
          })
          .eq('id', row.item_id);

        if (msg.includes('429') || msg.includes('rate')) {
          await new Promise((r) => setTimeout(r, 2000));
        }
        continue;
      }

      const { error: updateError } = await supabase
        .from('items')
        .update({
          embedding,
          embedding_updated_at: new Date().toISOString(),
          needs_embedding: false,
          embedding_error: null,
          embedding_error_at: null,
        })
        .eq('id', row.item_id);

      if (updateError) {
        await supabase
          .from('embedding_queue')
          .update({
            locked_at: null,
            locked_by: null,
            last_error: updateError.message,
          })
          .eq('id', row.id);
        continue;
      }

      await supabase
        .from('embedding_queue')
        .update({
          processed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          last_error: null,
        })
        .eq('id', row.id);
    }

    return new Response(JSON.stringify({ processed: rows.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
