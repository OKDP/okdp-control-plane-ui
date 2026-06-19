import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: ReactNode;
  description?: ReactNode;
  /** Optional call to action rendered below the description (e.g. a CtaButton). */
  action?: ReactNode;
  /** 'plain' (default) is the chrome-less centered layout — its geometry
   *  matches the project wizard, so don't add panel chrome to it. 'panel'
   *  renders the okdp empty-state-panel card. */
  variant?: 'plain' | 'panel';
}

/** Centered placeholder shown when a page or list has no content. */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'plain',
}: EmptyStateProps) {
  if (variant === 'panel') {
    return (
      <div className="empty-state-panel">
        <div className="empty-icon-wrapper">
          <i className={icon}></i>
        </div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        {action}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      {/* 52px circle — the same size as the okdp empty-icon-wrapper. */}
      <div className="mb-3 flex h-13 w-13 items-center justify-center rounded-full bg-surface-tertiary">
        <i className={`${icon} text-[1.5rem] text-fg-muted`}></i>
      </div>
      <h2 className="m-0 text-lg font-semibold text-fg">{title}</h2>
      {description && (
        <p className="mt-1 max-w-[340px] text-base text-fg-secondary">{description}</p>
      )}
      {action}
    </div>
  );
}
