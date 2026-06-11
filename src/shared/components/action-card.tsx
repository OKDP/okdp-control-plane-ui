import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Responsive grid wrapping a set of action cards. */
export function QuickActions({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 max-md:grid-cols-1">
      {children}
    </div>
  );
}

const ICON_TONES = {
  primary: 'bg-primary-50 text-primary',
  blue: 'bg-accent-blue-light text-accent-blue',
  purple: 'bg-accent-purple-light text-accent-purple',
} as const;

interface ActionCardProps {
  to: string;
  icon: string;
  tone: keyof typeof ICON_TONES;
  title: ReactNode;
  description: ReactNode;
}

/** Glassmorphism navigation card used in the home pages' quick-action grids. */
export function ActionCard({ to, icon, tone, title, description }: ActionCardProps) {
  return (
    <Link
      to={to}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-white/70 bg-white/60 px-5 py-3 text-fg no-underline shadow-[0_4px_16px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all duration-250 ease-smooth hover:-translate-y-0.5 hover:border-white hover:bg-white/95 hover:shadow-[0_12px_28px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2)] dark:hover:border-white/20 dark:hover:bg-white/[0.08] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ICON_TONES[tone]}`}
      >
        <i className={`${icon} text-[1rem]`}></i>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-md font-medium text-fg">{title}</span>
        <span className="text-sm text-fg-secondary">{description}</span>
      </div>
      <i className="pi pi-arrow-right shrink-0 text-[0.8rem] text-fg-muted opacity-0 transition-all duration-250 ease-smooth group-hover:text-primary group-hover:opacity-100"></i>
    </Link>
  );
}
