import { useEffect, useState } from 'react';
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Field, Input, Select, toast } from '@/components/ui';
import { useAI, AI_MODELS, type AIModel } from '@/stores/ai';
import { getAIStatus, type AIStatus } from '@/lib/ai';
import { Group, Note, Row, Section } from './common';

export function AISection() {
  const { apiKey, model } = useAI();
  const [key, setKey] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<AIStatus | null>(null);
  useEffect(() => setKey(apiKey), [apiKey]);
  useEffect(() => { void getAIStatus().then(setStatus); }, [apiKey]);

  const saveKey = async () => {
    const k = key.trim();
    if (k && !k.startsWith('sk-ant-')) { toast('Anthropic API keys start with "sk-ant-"', 'error'); return; }
    useAI.getState().setApiKey(k);
    await useAI.flush();
    toast(k ? 'API key saved on this device' : 'API key removed', 'success');
  };

  return (
    <Section title="Momento AI" description="Your assistant for planning, breaking down goals, summarising notes and reflecting.">
      {status && (
        <Note tone={status.ready ? 'success' : 'warn'}>
          <span className="flex items-center gap-1.5 font-medium">
            {status.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {status.ready ? 'Momento AI is ready.' : status.reason}
          </span>
        </Note>
      )}

      <Group title="Your API key">
        <Note>
          <p>Momento AI uses your own Anthropic API key. Momento doesn't provide a key or run a server for AI, so usage is billed to your Anthropic account.</p>
        </Note>
        <Note tone="warn">
          <p><b>Trade-off:</b> your key is stored unencrypted in this browser profile's extension storage (never synced or exported) and sent directly from your browser to api.anthropic.com. Anyone with access to this browser profile could read it. Use a dedicated key with a spend limit, and remove it when not needed.</p>
        </Note>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void saveKey(); }}>
          <Field label="Anthropic API key" className="flex-1" hint={<>Create one at <a className="underline" href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">platform.claude.com</a></>}>
            <div className="relative">
              <Input type={show ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" className="pr-9" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label={show ? 'Hide key' : 'Show key'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Button type="submit" variant="primary" disabled={key.trim() === apiKey}>Save</Button>
          {apiKey && <Button variant="ghost" onClick={() => { setKey(''); useAI.getState().setApiKey(''); toast('API key removed'); }}>Remove</Button>}
        </form>
      </Group>

      <Group title="Model">
        <Row label="Claude model" description={AI_MODELS.find((m) => m.value === model)?.hint}>
          <Select value={model} onChange={(e) => useAI.getState().setModel(e.target.value as AIModel)} className="w-48">
            {AI_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Row>
      </Group>

      <Group title="Privacy">
        <p className="text-xs text-muted">When you use a quick action, only the context it needs is sent (e.g. today's tasks, goal and events for "Plan my day", or the single note you choose to summarise). Conversations are stored on this device only and can be cleared at any time from the AI panel.</p>
      </Group>
    </Section>
  );
}
