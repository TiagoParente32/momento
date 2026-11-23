// Supabase Edge Function: permanently deletes the calling user's account.
// Deploy: supabase functions deploy delete-account
// Uses SUPABASE_SERVICE_ROLE_KEY, which only ever exists server-side.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(req, { error: 'Missing authorization' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return json(req, { error: 'Invalid or expired session' }, 401);

  // momento_state cascades on auth user delete; delete explicitly as well.
  await admin.from('momento_state').delete().eq('user_id', user.id);
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json(req, { error: delErr.message }, 500);

  return json(req, { ok: true });
});
