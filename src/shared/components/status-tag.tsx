import type { ReactNode } from 'react';

/** Color tone of a status pill — the app-wide okdp-tag palette. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_CLASS: Record<StatusTone, string> = {
  success: ' okdp-tag-success',
  warning: ' okdp-tag-warn',
  danger: ' okdp-tag-danger',
  info: ' okdp-tag-info',
  neutral: '',
};

interface StatusTagProps {
  value: string;
  tone: StatusTone;
  /** Animated activity dot for in-flight states (installing, running…). */
  pulse?: boolean;
  /** Optional leading icon (e.g. a spinner for in-flight deletes). */
  icon?: ReactNode;
  title?: string;
  className?: string;
}

/** The app's status pill (native okdp-tag, dark-mode aware) — the single
 *  status rendering shared by services, spark, pods and secrets, so a
 *  status reads the same on every page. */
export function StatusTag({ value, tone, pulse, icon, title, className }: StatusTagProps) {
  return (
    <span
      className={`okdp-tag${TONE_CLASS[tone]}${className ? ` ${className}` : ''}`}
      title={title}
    >
      {pulse && <span className="okdp-tag-dot"></span>}
      {icon}
      {value}
    </span>
  );
}
