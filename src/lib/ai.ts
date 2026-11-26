import Anthropic from '@anthropic-ai/sdk';
import { useAI, type AIModel } from '@/stores/ai';

/**
 * Momento AI client. Uses only the user's own Anthropic API key ("bring your own key"),
 * kept in chrome.storage.local on this device and sent directly to api.anthropic.com.
 * Momento never ships or proxies a key of its own. If no key is set, `getAIStatus()` says so.
 */

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export interface AIStatus { ready: boolean; reason?: string }

export async function getAIStatus(): Promise<AIStatus> {
  await useAI.ready;
  const { apiKey } = useAI.getState();
  return apiKey ? { ready: true } : { ready: false, reason: 'Add your Anthropic API key in Settings → Momento AI.' };
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
  const { apiKey, model } = useAI.getState();
  return streamDirect(apiKey, model, opts);
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
