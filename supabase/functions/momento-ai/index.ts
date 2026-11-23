// Supabase Edge Function: Momento AI proxy.
// - Verifies the caller's Supabase session (JWT).
// - Calls the Anthropic Messages API with ANTHROPIC_API_KEY (an Edge Function secret, never shipped to clients).
// - Streams text back as simple SSE: `data: {"text": "..."}` ... `data: [DONE]`.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy momento-ai
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
const MAX_MESSAGES = 40;
const MAX_CHARS = 120_000;

type Turn = { role: 'user' | 'assistant'; content: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(req, { error: 'Momento AI is not configured on the server (missing ANTHROPIC_API_KEY).' }, 503);

  // --- auth ---
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  if (authErr || !user) return json(req, { error: 'Please sign in to use Momento AI.' }, 401);

  // --- validate input ---
  let body: { system?: string; messages?: Turn[]; model?: string };
  try { body = await req.json(); } catch { return json(req, { error: 'Invalid JSON body' }, 400); }
  const messages = (body.messages ?? [])
    .filter((m): m is Turn => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.length > 0)
    .slice(-MAX_MESSAGES);
  if (!messages.length || messages[0].role !== 'user') return json(req, { error: 'Conversation must start with a user message.' }, 400);
  const total = messages.reduce((n, m) => n + m.content.length, 0) + (body.system?.length ?? 0);
  if (total > MAX_CHARS) return json(req, { error: 'Request too large.' }, 413);
  const model = MODELS.has(body.model ?? '') ? body.model! : 'claude-opus-5-5';

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n\n`));
      try {
        const msgStream = client.beta.messages.stream(
          {
            model,
            max_tokens: 16000,
            system: body.system?.slice(0, 20_000),
            messages,
            output_config: { effort: 'medium' },
            // Server-side refusal fallback (not offered for Haiku).
            ...(model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
          },
          { signal: req.signal },
        );
        for await (const event of msgStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') send({ text: event.delta.text });
        }
        const final = await msgStream.finalMessage();
        if (final.stop_reason === 'refusal') send({ text: "\n\n_Momento AI couldn't help with that request._" });
        send('[DONE]');
      } catch (e) {
        let message = 'AI request failed.';
        if (e instanceof Anthropic.RateLimitError) message = 'Momento AI is busy, please try again in a moment.';
        else if (e instanceof Anthropic.APIError) message = `AI provider error (${e.status ?? 'unknown'}).`;
        console.error('momento-ai error', e);
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders(req), 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
});
