import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: ReactNode;
  description?: ReactNode;
  /** Optional call to action rendered below the description (e.g. a CtaButton). */
  action?: ReactNode;
}

/** Centered placeholder shown when a page or list has no content. */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-tertiary">
        <i className={`${icon} text-[1.5rem] text-fg-muted`}></i>
      </div>
      <h2 className="m-0 text-lg font-semibold text-fg">{title}</h2>
      {description && <p className="mt-1 max-w-[340px] text-base text-fg-secondary">{description}</p>}
      {action}
    </div>
  );
}
