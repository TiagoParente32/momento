import { BellRing } from 'lucide-react';
import { Button, Toggle, toast } from '@/components/ui';
import { useS, useSettings } from '@/stores/settings';
import { isExtension } from '@/lib/storage';
import { Group, Note, Section } from './common';

export function NotificationsSection() {
  const s = useS();
  const set = (patch: Partial<typeof s.notifications>) => useSettings.getState().updateNested('notifications', patch);
  const n = s.notifications;

  const test = () => {
    if (isExtension && chrome.notifications) {
      chrome.notifications.create(`test-${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: 'Momento',
        message: 'Notifications are working. Make every moment count ✨',
      }, () => {
        if (chrome.runtime.lastError) toast(chrome.runtime.lastError.message ?? 'Notification failed', 'error');
        else toast('Test notification sent', 'success');
      });
    } else if ('Notification' in window) {
      Notification.requestPermission().then((p) => (p === 'granted' ? new Notification('Momento', { body: 'Notifications are working.' }) : toast('Notifications are blocked', 'error')));
    }
  };

  return (
    <Section title="Notifications" description="Gentle nudges from the background, even when no Momento tab is open.">
      <Group>
        <Toggle checked={n.enabled} onChange={(enabled) => set({ enabled })} label="Allow notifications" description="Master switch for every Momento notification" />
      </Group>
      <Group title="Notify me about">
        <Toggle disabled={!n.enabled} checked={n.focus} onChange={(focus) => set({ focus })} label="Focus sessions" description="When a focus session or break finishes" />
        <Toggle disabled={!n.enabled} checked={n.reminders} onChange={(reminders) => set({ reminders })} label="Task reminders" description="At the reminder time set on a task" />
        <Toggle disabled={!n.enabled} checked={n.events} onChange={(events) => set({ events })} label="Calendar events" description="Before events that have a reminder" />
        <Toggle disabled={!n.enabled} checked={n.breaks} onChange={(breaks) => set({ breaks })} label="Balance Mode breaks" description="Break reminders and end-of-day nudges" />
      </Group>
      <div className="flex items-center gap-3">
        <Button onClick={test} disabled={!n.enabled}><BellRing className="h-4 w-4" /> Send test notification</Button>
      </div>
      <Note>If nothing appears, check that Chrome is allowed to show notifications in your operating system's settings (Windows: Settings → System → Notifications; macOS: System Settings → Notifications → Google Chrome).</Note>
    </Section>
  );
}
