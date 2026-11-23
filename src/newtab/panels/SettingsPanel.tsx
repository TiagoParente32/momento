import { useEffect, useState } from 'react';
import {
  Settings2, User, Palette, LayoutGrid, Bell, Timer, CheckSquare, Scale, Plug, Sparkles, Gift, Shield, Database, Info,
} from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { useUI } from '@/stores/ui';
import { cn } from '@/lib/utils';
import { AccountSection } from './settings/AccountSection';
import { AppearanceSection } from './settings/AppearanceSection';
import { DashboardSection } from './settings/DashboardSection';
import { NotificationsSection } from './settings/NotificationsSection';
import { FocusSection, TasksSection } from './settings/FocusTasksSection';
import { BalanceSection } from './settings/BalanceSection';
import { IntegrationsSection } from './settings/IntegrationsSection';
import { AISection } from './settings/AISection';
import { PlanSection, PrivacySection, DataSection, AboutSection } from './settings/PrivacyDataSection';

const SECTIONS = [
  { id: 'account', label: 'Account & profile', icon: User, C: AccountSection },
  { id: 'appearance', label: 'Appearance', icon: Palette, C: AppearanceSection },
  { id: 'dashboard', label: 'Dashboard & widgets', icon: LayoutGrid, C: DashboardSection },
  { id: 'notifications', label: 'Notifications', icon: Bell, C: NotificationsSection },
  { id: 'focus', label: 'Focus', icon: Timer, C: FocusSection },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, C: TasksSection },
  { id: 'balance', label: 'Balance Mode', icon: Scale, C: BalanceSection },
  { id: 'integrations', label: 'Integrations', icon: Plug, C: IntegrationsSection },
  { id: 'ai', label: 'Momento AI', icon: Sparkles, C: AISection },
  { id: 'plan', label: 'Plan', icon: Gift, C: PlanSection },
  { id: 'privacy', label: 'Privacy', icon: Shield, C: PrivacySection },
  { id: 'data', label: 'Data & deletion', icon: Database, C: DataSection },
  { id: 'about', label: 'About & shortcuts', icon: Info, C: AboutSection },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];
// accept a few aliases used by other panels
const ALIASES: Record<string, SectionId> = { profile: 'account', calendar: 'integrations', widgets: 'dashboard', subscription: 'plan', export: 'data' };

export default function SettingsPanel() {
  const params = useUI((s) => s.params);
  const resolve = (s?: string): SectionId => (SECTIONS.some((x) => x.id === s) ? (s as SectionId) : ALIASES[s ?? ''] ?? 'account');
  const [active, setActive] = useState<SectionId>(() => resolve(params.section));
  useEffect(() => { if (params.section) setActive(resolve(params.section)); }, [params.section]);

  const Current = SECTIONS.find((s) => s.id === active)!.C;

  return (
    <PanelFrame
      title="Settings"
      icon={<Settings2 className="h-4 w-4" />}
      sidebar={
        <nav className="space-y-0.5" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              aria-current={active === id ? 'page' : undefined}
              className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition', active === id ? 'bg-accent/12 font-medium text-accent' : 'text-ink/75 hover:bg-ink/5 hover:text-ink')}
            >
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </button>
          ))}
        </nav>
      }
    >
      <Current />
    </PanelFrame>
  );
}
