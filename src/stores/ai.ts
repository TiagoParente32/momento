import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { uid } from '@/lib/utils';

export type AIMode = 'proxy' | 'byok';
export type AIModel = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';

export const AI_MODELS: { value: AIModel; label: string; hint: string }[] = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Most capable (default)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Fast and capable' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Fastest, lowest cost' },
];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** label of the quick action that produced the prompt */
  action?: string;
  error?: boolean;
}

/**
 * Momento AI config + conversation. Stored under KEYS.ai, which is excluded from
 * cloud sync and export — your own API key never leaves this device except to call Anthropic.
 */
export const useAI = createPersisted(
  KEYS.ai,
  {
    mode: 'proxy' as AIMode,
    apiKey: '',
    model: 'claude-opus-5-5' as AIModel,
    messages: [] as ChatMessage[],
  },
  (set) => ({
    setMode(mode: AIMode) { set({ mode }); },
    setApiKey(apiKey: string) { set({ apiKey: apiKey.trim() }); },
    setModel(model: AIModel) { set({ model }); },
    addMessage(m: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
      const msg: ChatMessage = { ...m, id: uid(), createdAt: new Date().toISOString() };
      set((s) => ({ messages: [...s.messages, msg].slice(-200) }));
      return msg;
    },
    updateMessage(id: string, patch: Partial<ChatMessage>) {
      set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    },
    clear() { set({ messages: [] }); },
  }),
);
