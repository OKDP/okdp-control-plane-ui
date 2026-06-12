import type { ReactNode } from 'react';
import { siApachespark } from 'simple-icons';
import type { ServiceInstance } from '../../core/models/service.model';
import { BrandIcon, type BrandGlyph } from '../../shared/components/brand-icon';
import { navItemBySegment, navItemIcon } from '../project-console/nav-config';

export type ViewTone = 'primary' | 'blue' | 'purple';

export interface UiServiceView {
  /** ServiceInstance.service value of the deployed instances. */
  service: string;
  label: string;
  /** primeicons class for the tile; the sidebar prefers the brand logo. */
  icon: string;
  /** Small primeicons glyph overlaid on the brand logo, telling sibling
   *  views of the same technology apart. */
  badge?: string;
  /** Path appended to the instance URL (sub-UIs like Superset's SQL Lab). */
  urlPath?: string;
  /** Tile description; defaults to "Open <instance> in a new tab". */
  description?: string;
  tone: ViewTone;
  /** NAV_CATEGORIES key the view is grouped under in the views sidebar. */
  categoryKey: string;
  /** Lateral-menu item segment, for the brand-logo lookup. */
  navSegment: string;
}

/** Views derived from deployed service instances: each entry becomes a
 *  launcher per instance exposing a URL. A service may carry several views
 *  (Superset's root UI and its SQL Lab). */
export const UI_SERVICE_VIEWS: UiServiceView[] = [
  {
    service: 'airflow',
    label: 'Airflow',
    icon: 'pi pi-sitemap',
    tone: 'blue',
    categoryKey: 'data-engineering',
    navSegment: 'airflow',
  },
  {
    service: 'spark-history-server',
    label: 'Spark History Server',
    icon: 'pi pi-history',
    tone: 'purple',
    categoryKey: 'data-engineering',
    navSegment: 'spark/history-server',
  },
  {
    service: 'jupyterhub',
    label: 'JupyterHub',
    icon: 'pi pi-desktop',
    tone: 'primary',
    categoryKey: 'notebooks',
    navSegment: 'jupyterhub',
  },
  {
    service: 'superset',
    label: 'Superset',
    icon: 'pi pi-chart-line',
    tone: 'primary',
    categoryKey: 'sql-bi',
    navSegment: 'superset',
  },
  {
    service: 'superset',
    label: 'SQL Lab',
    icon: 'pi pi-pencil',
    badge: 'pi pi-pencil',
    urlPath: '/sqllab/',
    description: 'Ad-hoc SQL queries in Superset',
    tone: 'primary',
    categoryKey: 'sql-bi',
    navSegment: 'superset',
  },
];

export interface BuiltInView {
  label: string;
  description: string;
  /** primeicons fallback when the view has no brand logo. */
  icon: string;
  /** Brand logo of the underlying technology. */
  brand?: BrandGlyph;
  /** Small primeicons glyph overlaid on the brand logo, telling sibling
   *  views of the same technology apart. */
  badge?: string;
  tone: ViewTone;
  /** NAV_CATEGORIES key the view is grouped under in the views sidebar. */
  categoryKey: string;
  path: (projectName: string) => string;
}

/** Rich technology-specific views that don't fit the "one service, one
 *  instance list" shape of the lateral menu (currently the Spark pages). */
export const BUILT_IN_VIEWS: BuiltInView[] = [
  {
    label: 'Spark Applications',
    description: 'Submitted Spark jobs and their live status',
    icon: 'pi pi-bolt',
    brand: siApachespark,
    badge: 'pi pi-bolt',
    tone: 'blue',
    categoryKey: 'data-engineering',
    path: (projectName) => `/projects/${projectName}/views/spark/applications`,
  },
];

/** Small glyph overlaid on a brand logo, telling sibling views of the same
 *  technology apart. Inherits the surrounding text color, so it adapts to
 *  tiles and sidebar items alike. */
function withBadge(icon: ReactNode, badge: string): ReactNode {
  return (
    <span className="relative inline-flex shrink-0">
      {icon}
      <i
        className={`${badge} absolute -right-1 -bottom-0.5 rounded-full bg-surface p-px text-[length:calc(0.5rem*var(--nav-item-scale,1))] leading-none`}
      ></i>
    </span>
  );
}

/** Brand logo (with its badge) when the view has one, primeicons fallback
 *  otherwise — the views' counterpart of nav-config's navItemIcon. */
export function builtInViewIcon(view: BuiltInView): ReactNode {
  if (!view.brand) return view.icon;
  const brand = <BrandIcon icon={view.brand} />;
  return view.badge ? withBadge(brand, view.badge) : brand;
}

/** Brand logo borrowed from the service's lateral-menu entry (badged when
 *  the view declares one), primeicons fallback otherwise — tiles and sidebar
 *  items show a service the same way. */
export function uiServiceViewIcon(view: UiServiceView): ReactNode {
  const navItem = navItemBySegment(view.navSegment);
  const base = navItem ? navItemIcon(navItem) : view.icon;
  if (!view.badge || typeof base === 'string') return base;
  return withBadge(base, view.badge);
}

export interface UiServiceLauncher {
  svc: ServiceInstance;
  view: UiServiceView;
}

/** Instances that get launchers — the same gate as the instance list's
 *  "Open" action: a known UI service exposing a URL. One launcher per view
 *  declared for the service. */
export function uiServiceLaunchers(instances: ServiceInstance[]): UiServiceLauncher[] {
  return instances.flatMap((svc) => {
    if (!svc.url) return [];
    return UI_SERVICE_VIEWS.filter((v) => v.service === svc.service).map((view) => ({
      svc,
      view,
    }));
  });
}

/** Target of a launcher: the instance URL plus the view's sub-path. */
export function launcherUrl({ svc, view }: UiServiceLauncher): string {
  return `${(svc.url ?? '').replace(/\/$/, '')}${view.urlPath ?? ''}`;
}
