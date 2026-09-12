import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    global: { headers: { Authorization: authHeader } }
  });

  try {
    const body = await req.json();
    const { conversation_id, auto_suggest_source = true } = body;

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'Missing conversation_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Calculate lead score
    const scoreResult = await db.rpc('calculate_lead_score', { conversation_id });
    if (scoreResult.error) throw scoreResult.error;
    const lead_score = scoreResult.data as number;

    let suggested_source_id: string | null = null;
    if (auto_suggest_source) {
      const sourceResult = await db.rpc('suggest_pipeline_source', { conversation_id });
      if (!sourceResult.error) {
        suggested_source_id = sourceResult.data;
      }
    }

    // Get conversation details for response
    const { data: conv } = await db.from('whatsapp_conversations')
      .select('id, phone, profile_name, reference_code, lead_score, score_breakdown')
      .eq('id', conversation_id)
      .single();

    return new Response(JSON.stringify({
      ok: true,
      conversation_id,
      lead_score,
      suggested_source_id,
      reference_code: conv?.reference_code,
      score_breakdown: conv?.score_breakdown
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Lead scorer error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});