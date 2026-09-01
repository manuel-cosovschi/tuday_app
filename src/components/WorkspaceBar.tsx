'use client';

import { useStore } from '@/lib/store';
import { Eye, User } from 'lucide-react';

export function WorkspaceBar() {
  const workspaces = useStore((s) => s.workspaces);
  const current = useStore((s) => s.workspaceOwnerId);
  const userId = useStore((s) => s.userId);
  const switchWorkspace = useStore((s) => s.switchWorkspace);

  if (workspaces.length <= 1) return null;

  const managing = current && current !== userId;

  return (
    <div className="px-4 pt-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        {workspaces.map((w) => {
          const active = w.owner_id === current;
          const isMine = w.owner_id === userId;
          return (
            <button
              key={w.owner_id}
              onClick={() => switchWorkspace(w.owner_id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[var(--card)] text-slate-500 border border-[var(--hairline)]'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              {isMine ? 'Mi calendario' : w.name}
            </button>
          );
        })}
      </div>
      {managing && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <Eye className="h-3.5 w-3.5" />
          Estás gestionando un calendario ajeno. Los cambios los ve la otra persona.
        </div>
      )}
    </div>
  );
}
