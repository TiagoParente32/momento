import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useUI } from '@/stores/ui';

/**
 * Standard chrome for every app panel (Tasks, Notes, …). Panels render inside
 * the slide-over drawer on the dashboard; they should fill the given height and
 * manage their own internal scrolling.
 */
export function PanelFrame({ title, icon, actions, children, sidebar }: { title: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; sidebar?: ReactNode }) {
  const close = useUI((s) => s.closePanel);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line/10 px-5 py-3.5">
        {icon && <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/12 text-accent">{icon}</span>}
        <h2 className="flex-1 truncate text-lg font-semibold tracking-tight">{title}</h2>
        {actions}
        <IconButton label="Close panel" onClick={close}>
          <X className="h-4 w-4" />
        </IconButton>
      </header>
      <div className="flex min-h-0 flex-1">
        {sidebar && <aside className="w-56 shrink-0 overflow-y-auto border-r border-line/10 p-3 scroll-thin">{sidebar}</aside>}
        <div className="min-w-0 flex-1 overflow-y-auto scroll-thin">{children}</div>
      </div>
    </div>
  );
}
