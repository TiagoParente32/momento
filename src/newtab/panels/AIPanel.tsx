import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, Send, Square, Trash2, Copy, CalendarClock, ListTree, ListChecks, Lightbulb, FileText,
  GraduationCap, TrendingUp, Heart, Moon, Settings2, Plus, Check, AlertCircle,
} from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, EmptyState, Field, IconButton, Input, Modal, Select, Spinner, Textarea, confirmDialog, toast } from '@/components/ui';
import { useAI, type ChatMessage } from '@/stores/ai';
import { useUI } from '@/stores/ui';
import { useTasks } from '@/stores/tasks';
import { getAIStatus, parseTaskBlock, streamChat, type AIStatus, type SuggestedTask } from '@/lib/ai';
import { listsForPicker, noteText, notesForPicker, reflectionContext, statsContext, todayContext } from './ai/context';
import { Markdown } from './ai/Markdown';
import { cn, todayISO } from '@/lib/utils';
import type { Task } from '@/lib/types';

const SYSTEM = `You are Momento AI, a calm, encouraging productivity assistant inside the Momento new-tab dashboard.
Be concise and practical. Use short markdown: headings, bullet lists, **bold** for key points. Avoid long preambles.
When asked to produce tasks, write a brief intro, then a fenced \`\`\`json block containing an array of objects:
{"title": string, "priority": "none"|"low"|"medium"|"high"|"urgent", "dueDate": "YYYY-MM-DD" | null}.
Keep task titles short and actionable (start with a verb). Only include the JSON block when tasks are requested.`;

type ActionId = 'plan' | 'breakdown' | 'tasklist' | 'brainstorm' | 'summarise' | 'study' | 'tips' | 'motivate' | 'reflect';
interface QuickAction {
  id: ActionId;
  label: string;
  icon: typeof Sparkles;
  input?: { label: string; placeholder: string; kind: 'text' | 'textarea' | 'note' };
  build: (input: string) => string;
}

const TASKS_HINT = `\n\nToday's date is ${todayISO()}. Return the tasks in the JSON format described.`;

const ACTIONS: QuickAction[] = [
  { id: 'plan', label: 'Plan my day', icon: CalendarClock,
    build: () => `Help me plan my day. Suggest a realistic time-blocked schedule around my calendar, putting my main goal and most important tasks first, with breaks.\n\n${todayContext()}` },
  { id: 'breakdown', label: 'Break down a goal', icon: ListTree,
    input: { label: 'What goal do you want to break down?', placeholder: 'e.g. Launch my portfolio website', kind: 'text' },
    build: (g) => `Break this goal into small, concrete tasks (5–12), ordered logically, with sensible priorities and due dates if useful: "${g}"${TASKS_HINT}` },
  { id: 'tasklist', label: 'Generate a task list', icon: ListChecks,
    input: { label: 'What do you need a task list for?', placeholder: 'e.g. Moving to a new apartment next month', kind: 'text' },
    build: (t) => `Generate a practical task list for: "${t}"${TASKS_HINT}` },
  { id: 'brainstorm', label: 'Brainstorm ideas', icon: Lightbulb,
    input: { label: 'What should we brainstorm?', placeholder: 'e.g. Side project ideas for learning Rust', kind: 'text' },
    build: (t) => `Brainstorm creative, varied ideas for: "${t}". Group them and add one line on why each is promising.` },
  { id: 'summarise', label: 'Summarise a note', icon: FileText,
    input: { label: 'Choose a note', placeholder: '', kind: 'note' },
    build: (id) => {
      const n = noteText(id);
      return n ? `Summarise this note titled "${n.title}". Give a 2–3 sentence summary, key points, and any action items.\n\n---\n${n.text}` : 'The note could not be found.';
    } },
  { id: 'study', label: 'Create a study plan', icon: GraduationCap,
    input: { label: 'What are you studying, and by when?', placeholder: 'e.g. Organic chemistry exam on 15 December, 1h per day', kind: 'textarea' },
    build: (t) => `Create a study plan for: "${t}". Include a schedule, techniques (spaced repetition, active recall), and milestones. Also include the study sessions as tasks.${TASKS_HINT}` },
  { id: 'tips', label: 'Productivity tips', icon: TrendingUp,
    build: () => `Based on my recent stats, suggest 3–5 specific productivity improvements. Be encouraging and concrete.\n\n${statsContext(7)}` },
  { id: 'motivate', label: 'Motivate me', icon: Heart,
    build: () => `Write me a short, genuine motivational message for today (3–4 sentences), tailored to what I'm working on.\n\n${todayContext()}` },
  { id: 'reflect', label: 'Daily reflection', icon: Moon,
    build: () => `Help me reflect on my day. Celebrate what I achieved, then ask me 3 thoughtful reflection questions and suggest one intention for tomorrow.\n\n${reflectionContext()}` },
];

export default function AIPanel() {
  const messages = useAI((s) => s.messages);
  const model = useAI((s) => s.model);
  const mode = useAI((s) => s.mode);
  const openPanel = useUI((s) => s.openPanel);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [draft, setDraft] = useState('');
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [pending, setPending] = useState<QuickAction | null>(null);
  const [pendingInput, setPendingInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void getAIStatus().then(setStatus); }, [mode, model]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (prompt: string, action?: string) => {
    const text = prompt.trim();
    if (!text || streamingId) return;
    const st = await getAIStatus();
    setStatus(st);
    if (!st.ready) { toast(st.reason ?? 'Momento AI is not set up.', 'error'); return; }

    const { addMessage, updateMessage } = useAI.getState();
    const history = useAI.getState().messages.filter((m) => !m.error).slice(-20);
    addMessage({ role: 'user', content: text, action });
    const reply = addMessage({ role: 'assistant', content: '' });
    setStreamingId(reply.id);
    setDraft('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = '';
    try {
      const turns = [...history.map((m) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: text }];
      // API requires the first turn to be from the user
      while (turns.length && turns[0].role !== 'user') turns.shift();
      await streamChat({
        system: SYSTEM,
        messages: turns.filter((t) => t.content.trim()),
        signal: ctrl.signal,
        onText: (d) => { acc += d; updateMessage(reply.id, { content: acc }); },
      });
      if (!acc.trim()) updateMessage(reply.id, { content: ctrl.signal.aborted ? '_Stopped._' : '_No response._' });
    } catch (e: any) {
      updateMessage(reply.id, { content: e?.message ?? 'Something went wrong.', error: true });
    } finally {
      setStreamingId(null);
      abortRef.current = null;
    }
  };

  const runAction = (a: QuickAction) => {
    if (a.input) { setPending(a); setPendingInput(''); return; }
    void send(a.build(''), a.label);
  };

  const notes = useMemo(() => (pending?.input?.kind === 'note' ? notesForPicker() : []), [pending]);

  const clear = async () => {
    if (!messages.length) return;
    if (await confirmDialog({ title: 'Clear conversation?', message: 'This removes all messages from this device.', confirmLabel: 'Clear', danger: true })) {
      abortRef.current?.abort();
      useAI.getState().clear();
    }
  };

  return (
    <PanelFrame
      title="Momento AI"
      icon={<Sparkles className="h-4 w-4" />}
      actions={
        <>
          <IconButton label="AI settings" onClick={() => openPanel('settings', { section: 'ai' })}><Settings2 className="h-4 w-4" /></IconButton>
          <IconButton label="Clear conversation" onClick={clear} disabled={!messages.length}><Trash2 className="h-4 w-4" /></IconButton>
        </>
      }
    >
      <div className="flex h-full flex-col">
        {status && !status.ready && (
          <div className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="font-medium">Momento AI isn't set up yet</p>
              <p className="text-muted">{status.reason}</p>
            </div>
            <Button size="sm" variant="primary" onClick={() => openPanel('settings', { section: 'ai' })}>Set up</Button>
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 scroll-thin" aria-live="polite">
          {!messages.length ? (
            <div className="mx-auto max-w-2xl">
              <EmptyState icon={<Sparkles className="h-6 w-6" />} title="How can I help you today?" description="Plan your day, break down big goals, summarise notes or reflect on your progress." />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACTIONS.map((a) => (
                  <button key={a.id} onClick={() => runAction(a)} className="card flex items-center gap-2 px-3 py-3 text-left text-sm transition hover:border-accent/40 hover:bg-accent/5">
                    <a.icon className="h-4 w-4 shrink-0 text-accent" /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <Message key={m.id} m={m} streaming={m.id === streamingId} onRetry={(t) => send(t)} />)
          )}
        </div>

        <div className="border-t border-line/10 px-5 py-3">
          {messages.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
              {ACTIONS.map((a) => (
                <button key={a.id} onClick={() => runAction(a)} disabled={!!streamingId} className="chip shrink-0 bg-ink/5 py-1 text-muted transition hover:bg-accent/10 hover:text-accent disabled:opacity-50">
                  <a.icon className="h-3 w-3" /> {a.label}
                </button>
              ))}
            </div>
          )}
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
              placeholder="Ask Momento AI anything…  (Enter to send, Shift+Enter for a new line)"
              className="max-h-40 min-h-[44px] flex-1"
              rows={1}
              aria-label="Message Momento AI"
            />
            {streamingId ? (
              <Button variant="secondary" size="lg" onClick={() => abortRef.current?.abort()} aria-label="Stop generating"><Square className="h-4 w-4" /> Stop</Button>
            ) : (
              <Button type="submit" variant="primary" size="lg" disabled={!draft.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
            )}
          </form>
          <p className="mt-1.5 text-[11px] text-muted">
            {mode === 'byok' ? 'Using your own Anthropic API key' : 'Using the secure Momento AI proxy'} · AI can make mistakes — double-check important details.
          </p>
        </div>
      </div>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.label}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="primary" disabled={!pendingInput.trim()} onClick={() => { const a = pending!; setPending(null); void send(a.build(pendingInput.trim()), a.label); }}>
              <Sparkles className="h-4 w-4" /> Ask
            </Button>
          </>
        }
      >
        {pending?.input && (
          <Field label={pending.input.label}>
            {pending.input.kind === 'note' ? (
              notes.length ? (
                <Select value={pendingInput} onChange={(e) => setPendingInput(e.target.value)}>
                  <option value="">Select a note…</option>
                  {notes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Untitled'}</option>)}
                </Select>
              ) : <p className="text-sm text-muted">You don't have any notes yet.</p>
            ) : pending.input.kind === 'textarea' ? (
              <Textarea value={pendingInput} onChange={(e) => setPendingInput(e.target.value)} placeholder={pending.input.placeholder} />
            ) : (
              <Input value={pendingInput} onChange={(e) => setPendingInput(e.target.value)} placeholder={pending.input.placeholder}
                onKeyDown={(e) => { if (e.key === 'Enter' && pendingInput.trim()) { const a = pending!; setPending(null); void send(a.build(pendingInput.trim()), a.label); } }} />
            )}
          </Field>
        )}
      </Modal>
    </PanelFrame>
  );
}

function Message({ m, streaming, onRetry }: { m: ChatMessage; streaming: boolean; onRetry: (t: string) => void }) {
  const isUser = m.role === 'user';
  const suggested = !isUser && !streaming && !m.error ? parseTaskBlock(m.content) : null;
  // Hide the raw JSON block from the rendered text when we show the task picker.
  const display = suggested ? m.content.replace(/```json[\s\S]*?```/i, '').trim() : m.content;
  const shownUser = isUser && m.action ? m.action : null;

  return (
    <div className={cn('group flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5', isUser ? 'bg-accent text-white' : m.error ? 'border border-red-500/30 bg-red-500/10' : 'card')}>
        {isUser ? (
          shownUser ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium">{shownUser}</summary>
              <p className="mt-1 whitespace-pre-wrap text-xs opacity-80">{m.content}</p>
            </details>
          ) : <p className="whitespace-pre-wrap text-sm">{m.content}</p>
        ) : m.content ? (
          <>
            {m.error ? <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><AlertCircle className="h-4 w-4" />{m.content}</p> : <Markdown text={display} />}
            {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />}
          </>
        ) : (
          <Spinner className="h-4 w-4" />
        )}
        {suggested && <TaskSuggestions tasks={suggested} />}
        {!isUser && !streaming && m.content && !m.error && (
          <div className="mt-1 flex justify-end opacity-0 transition group-hover:opacity-100">
            <button className="rounded p-1 text-muted hover:text-ink" aria-label="Copy message"
              onClick={() => navigator.clipboard.writeText(m.content).then(() => toast('Copied', 'success'))}>
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {m.error && (
          <button className="mt-1 text-xs text-muted underline" onClick={() => {
            const msgs = useAI.getState().messages;
            const idx = msgs.findIndex((x) => x.id === m.id);
            const prev = msgs.slice(0, idx).reverse().find((x) => x.role === 'user');
            if (prev) onRetry(prev.content);
          }}>Retry</button>
        )}
      </div>
    </div>
  );
}

function TaskSuggestions({ tasks }: { tasks: SuggestedTask[] }) {
  const lists = listsForPicker();
  const [selected, setSelected] = useState<boolean[]>(() => tasks.map(() => true));
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [added, setAdded] = useState(false);
  const count = selected.filter(Boolean).length;

  const add = () => {
    const store = useTasks.getState() as unknown as { addTask: (t: Partial<Task> & { title: string }) => unknown };
    if (typeof store.addTask !== 'function') { toast('Task store unavailable', 'error'); return; }
    tasks.forEach((t, i) => {
      if (!selected[i]) return;
      store.addTask({ title: t.title, listId: listId || undefined, priority: t.priority ?? 'none', dueDate: t.dueDate ?? null, description: t.description ?? '' });
    });
    setAdded(true);
    toast(`Added ${count} task${count === 1 ? '' : 's'}`, 'success');
  };

  return (
    <div className="mt-3 rounded-xl border border-line/10 bg-ink/[0.03] p-3">
      <p className="section-title mb-2">Suggested tasks</p>
      <ul className="space-y-1">
        {tasks.map((t, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={selected[i]} disabled={added} onChange={(e) => setSelected((s) => s.map((v, j) => (j === i ? e.target.checked : v)))} />
              <span className="flex-1">{t.title}</span>
              {t.priority && t.priority !== 'none' && <span className="chip bg-accent/10 text-accent">{t.priority}</span>}
              {t.dueDate && <span className="text-xs text-muted">{t.dueDate}</span>}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        {lists.length > 0 && (
          <Select value={listId} onChange={(e) => setListId(e.target.value)} className="h-8 max-w-[11rem] py-1 text-xs" disabled={added} aria-label="Target list">
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        )}
        <Button size="sm" variant={added ? 'secondary' : 'primary'} disabled={added || !count} onClick={add}>
          {added ? <><Check className="h-3.5 w-3.5" /> Added</> : <><Plus className="h-3.5 w-3.5" /> Add {count} to tasks</>}
        </Button>
      </div>
    </div>
  );
}
