import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** One-line description rendered under the title. */
  subtitle?: ReactNode;
  /** Thin breadcrumb above the title (service list pages). */
  breadcrumb?: { parent: string; current: string };
  /** Right side of the title line (create button, toggles…). */
  actions?: ReactNode;
}

/** Standard page heading: one title style on every page, with optional
 *  breadcrumb, subtitle and right-aligned actions on the title line. */
export function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="page-heading">
      <div>
        {breadcrumb && (
          <div className="breadcrumb-thin">
            <span>{breadcrumb.parent}</span>
            <i className="pi pi-angle-right text-[10px]"></i>
            <span className="bc-current">{breadcrumb.current}</span>
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
