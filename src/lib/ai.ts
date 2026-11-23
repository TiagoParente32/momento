import Anthropic from '@anthropic-ai/sdk';
import { getSupabase, getSupabaseConfig } from './supabase';
import { useAI, type AIModel } from '@/stores/ai';

/**
 * Momento AI client. Two modes:
 *  - 'proxy': calls the `momento-ai` Supabase Edge Function with the signed-in user's
 *    session token. The Anthropic API key lives only on the server (Edge Function secret).
 *  - 'byok':  "bring your own key" — the user's own Anthropic key, kept in chrome.storage.local
 *    on this device and sent directly to api.anthropic.com from the browser.
 * Nothing is ever faked: if neither mode is usable, `getAIStatus()` says why.
 */

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export interface AIStatus { ready: boolean; mode: 'proxy' | 'byok'; reason?: string }

export async function getAIStatus(): Promise<AIStatus> {
  await useAI.ready;
  const { mode, apiKey } = useAI.getState();
  if (mode === 'byok') {
    return apiKey ? { ready: true, mode } : { ready: false, mode, reason: 'Add your Anthropic API key in Settings → Momento AI.' };
  }
  const cfg = await getSupabaseConfig();
  if (!cfg) return { ready: false, mode, reason: 'The secure AI proxy needs a Supabase project (Settings → Account), or switch to "Use my own API key".' };
  const sb = await getSupabase();
  const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
  if (!data.session) return { ready: false, mode, reason: 'Sign in to your Momento account (Settings → Account) to use the AI proxy.' };
  return { ready: true, mode };
}

export class AIError extends Error {}

interface StreamOpts {
  system: string;
  messages: ChatTurn[];
  onText: (delta: string) => void;
  signal?: AbortSignal;
}

/** Streams a reply; resolves with the full text. */
export async function streamChat(opts: StreamOpts): Promise<string> {
  await useAI.ready;
  const { mode, apiKey, model } = useAI.getState();
  return mode === 'byok' ? streamDirect(apiKey, model, opts) : streamProxy(model, opts);
}

/** Server-side refusal fallback: "default" routes by category; Haiku has no server-side fallback. */
function fallbackParams(model: AIModel) {
  if (model === 'claude-haiku-5-5') return {};
  return { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };
}

async function streamDirect(apiKey: string, model: AIModel, { system, messages, onText, signal }: StreamOpts) {
  if (!apiKey) throw new AIError('No API key configured.');
  // dangerouslyAllowBrowser makes the SDK send `anthropic-dangerous-direct-browser-access: true`.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let text = '';
  try {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 16000,
        system,
        messages,
        output_config: { effort: 'medium' },
        ...fallbackParams(model),
      },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text;
        onText(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      const note = '\n\n_Momento AI couldn\'t help with that request._';
      text += note; onText(note);
    }
    return text;
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError) return text;
    if (e instanceof Anthropic.AuthenticationError) throw new AIError('Your Anthropic API key was rejected. Check it in Settings → Momento AI.');
    if (e instanceof Anthropic.RateLimitError) throw new AIError('Rate limited by Anthropic — please wait a moment and try again.');
    if (e instanceof Anthropic.APIError) throw new AIError(`Anthropic API error ${e.status ?? ''}: ${e.message}`);
    throw e;
  }
}

async function streamProxy(model: AIModel, { system, messages, onText, signal }: StreamOpts) {
  const cfg = await getSupabaseConfig();
  const sb = await getSupabase();
  if (!cfg || !sb) throw new AIError('AI proxy is not configured.');
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new AIError('Sign in to use Momento AI.');

  let res: Response;
  try {
    res = await fetch(`${cfg.url}/functions/v1/momento-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, apikey: cfg.anonKey },
      body: JSON.stringify({ system, messages, model }),
      signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') return '';
    throw new AIError('Could not reach the Momento AI proxy. Is the momento-ai function deployed?');
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new AIError(body.error ?? `AI proxy error (${res.status}).`);
  }

  // Our proxy emits SSE lines: data: {"text":"..."} | data: {"error":"..."} | data: [DONE]
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return text;
          const ev = JSON.parse(payload) as { text?: string; error?: string };
          if (ev.error) throw new AIError(ev.error);
          if (ev.text) { text += ev.text; onText(ev.text); }
        }
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return text;
    throw e;
  }
  return text;
}

/** Extracts a fenced ```json task array from a model reply. */
export interface SuggestedTask { title: string; priority?: 'low' | 'medium' | 'high' | 'urgent' | 'none'; dueDate?: string | null; description?: string }
export function parseTaskBlock(text: string): SuggestedTask[] | null {
  const m = text.match(/```json\s*([\s\S]*?)```/i);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tasks) ? parsed.tasks : null;
    if (!arr) return null;
    const out = arr
      .filter((t: any) => t && typeof t.title === 'string' && t.title.trim())
      .map((t: any) => ({
        title: String(t.title).trim().slice(0, 200),
        priority: ['low', 'medium', 'high', 'urgent', 'none'].includes(t.priority) ? t.priority : 'none',
        dueDate: typeof t.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : null,
        description: typeof t.description === 'string' ? t.description : '',
      }));
    return out.length ? out : null;
  } catch { return null; }
}
