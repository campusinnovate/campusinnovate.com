import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  // Verify cron secret
  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const result = await db.rpc('check_stale_conversations');
    if (result.error) throw result.error;

    return new Response(JSON.stringify({ ok: true, stale_count: result.data }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Stale checker error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});