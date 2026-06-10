import type { ReactNode } from 'react';

interface WelcomeBannerProps {
  icon: string;
  title: ReactNode;
  subtitle: ReactNode;
}

/** Glassmorphism banner shown at the top of the admin and project home pages. */
export default function WelcomeBanner({ icon, title, subtitle }: WelcomeBannerProps) {
  return (
    <div className="relative rounded-2xl border border-white/90 bg-white/70 p-7 shadow-[0_12px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary">
          <i className={`${icon} text-[1.1rem] text-white`}></i>
        </div>
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-[-0.01em] text-fg">{title}</h1>
          <p className="mt-0.5 text-base text-fg-secondary">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
