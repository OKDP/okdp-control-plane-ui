import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface CtaButtonProps {
  to: string;
  icon?: string;
  children: ReactNode;
}

/** Primary call-to-action link, used below empty states. */
export default function CtaButton({ to, icon, children }: CtaButtonProps) {
  return (
    <Link
      to={to}
      className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 py-[7px] text-md font-medium text-white no-underline transition-colors duration-250 ease-smooth hover:bg-primary-hover"
    >
      {icon && <i className={icon}></i>}
      {children}
    </Link>
  );
}
