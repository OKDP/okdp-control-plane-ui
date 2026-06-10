import type { ReactNode } from 'react';

/** Small uppercase label introducing a page section. */
export default function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="m-0 text-xs font-semibold tracking-[0.6px] text-fg-muted uppercase">
      {children}
    </h2>
  );
}
