import {
  siApachekafka,
  siApachespark,
  siApachesuperset,
  siJupyter,
  siMlflow,
  siTrino,
} from 'simple-icons';
import { BrandIcon, type BrandGlyph } from '../../shared/components/brand-icon';
import { areaBasePath } from './services/service-utils';
import type { MenuCategory, PlatformService } from '../../core/models/service.model';

/** Apache Airflow brandmark, vendored from the official multicolor pinwheel
 *  icon (via the gilbarbara/svg-logos collection, CC0) — the simple-icons
 *  variant is outline-only hairlines and unreadable at sidebar size. */
const siteApacheairflow: BrandGlyph = {
  viewBox: '0 0 256 256',
  paths: [
    {
      fill: '#017cee',
      d: 'm4.127 254.974l122.568-125.639a2.265 2.265 0 0 0 .274-2.896c-7.453-10.406-21.207-12.21-26.303-19.203c-15.098-20.711-18.929-32.434-25.417-31.708a1.98 1.98 0 0 0-1.178.622l-44.276 45.388C4.322 147.628.661 205.137 0 253.295a2.4 2.4 0 0 0 4.127 1.679',
    },
    {
      fill: '#00ad46',
      d: 'M254.974 251.873L129.335 129.296a2.266 2.266 0 0 0-2.9-.274c-10.406 7.457-12.21 21.207-19.203 26.303c-20.712 15.098-32.435 18.93-31.709 25.417c.066.451.286.866.622 1.174l45.389 44.276c26.09 25.473 83.598 29.134 131.757 29.795a2.401 2.401 0 0 0 1.683-4.114',
    },
    {
      fill: '#04d659',
      d: 'M121.534 226.205c-14.263-13.915-20.872-41.44 6.462-98.2c-44.437 19.859-60.008 45.962-52.35 53.437z',
    },
    {
      fill: '#00c7d4',
      d: 'M251.869 1.03L129.305 126.67a2.26 2.26 0 0 0-.274 2.895c7.457 10.406 21.202 12.21 26.303 19.203c15.098 20.712 18.933 32.435 25.417 31.709c.453-.065.87-.285 1.178-.622l44.276-45.389C251.678 108.376 255.339 50.868 256 2.71a2.405 2.405 0 0 0-4.131-1.678',
    },
    {
      fill: '#11e1ee',
      d: 'M226.226 134.466c-13.915 14.263-41.44 20.873-98.204-6.462c19.859 44.437 45.963 60.009 53.437 52.351z',
    },
    {
      fill: '#e43921',
      d: 'm1.018 4.131l125.638 122.565c.772.78 1.992.896 2.896.273c10.406-7.457 12.21-21.207 19.203-26.303c20.712-15.098 32.435-18.929 31.709-25.417a2 2 0 0 0-.622-1.178l-45.389-44.276C108.363 4.322 50.855.661 2.696 0a2.4 2.4 0 0 0-1.678 4.131',
    },
    {
      fill: '#ff7557',
      d: 'M134.475 29.8c14.263 13.915 20.872 41.44-6.462 98.204c44.437-19.859 60.008-45.967 52.35-53.437z',
    },
    {
      fill: '#0cb6ff',
      d: 'M29.795 121.543C43.71 107.28 71.235 100.67 128 128.004c-19.86-44.436-45.963-60.008-53.438-52.35z',
    },
    {
      fill: '#4a4848',
      d: 'M133.496 127.983a5.479 5.479 0 1 1-10.958 0a5.479 5.479 0 1 1 10.958 0',
    },
  ],
};

/** Apache Polaris brandmark, vendored from the project site's favicon
 *  (site/static/favicons/favicon.svg, Apache-2.0) — not in simple-icons. */
const siteApachepolaris: BrandGlyph = {
  hex: '007880',
  viewBox: '0 0 100 100',
  path: 'M1.77396 5.30235C1.17886 4.57499 0 4.9958 0 5.93559V97.8878C0 99.0543 0.945669 100 2.11221 100H94.0452C94.9854 100 95.4059 98.8203 94.6778 98.2255L51.5956 63.0332C50.769 62.3579 49.5973 62.3044 48.7124 62.9013L23.4326 79.9586C21.4731 81.2806 19.1256 78.933 20.4475 76.9737L37.5039 51.6949C38.1012 50.8094 38.0472 49.6369 37.3709 48.8102L1.77396 5.30235ZM98.2255 94.6778C98.8203 95.4059 100 94.9854 100 94.0452V2.11221C100 0.945669 99.0543 0 97.8878 0H5.93558C4.99579 0 4.57499 1.17886 5.30235 1.77396L48.8102 37.3709C49.6369 38.0472 50.8094 38.1014 51.6949 37.5039L76.9735 20.4475C78.9328 19.1256 81.2805 21.4732 79.9586 23.4325L62.9013 48.7125C62.3043 49.5973 62.3579 50.769 63.0332 51.5957L98.2255 94.6778Z',
};

export interface NavItem {
  /** Path under /projects/:projectId — absent for inert placeholders. */
  segment?: string;
  /** primeicons fallback for services without a packaged brand logo. */
  icon: string;
  /** Brand logo (favicon equivalent) rendered instead of `icon`. */
  brand?: BrandGlyph;
  /** Follow text color instead of brand hex (near-black brands). */
  brandMono?: boolean;
  label: string;
  disabled?: boolean;
  /** Hidden from the menu unless the user enables it in their settings. */
  defaultHidden?: boolean;
  collapsedTitle?: string;
}

export interface NavCategory {
  key: string;
  label: string;
  icon: string;
  defaultExpanded: boolean;
  /** Core console functions — exempt from the user's show/hide preferences. */
  fixed?: boolean;
  items: NavItem[];
}

/** Sidebar categories and their service entries, in display order. Shared by
 *  the project console (renderer) and the settings page (per-item show/hide
 *  toggles). */
export const NAV_CATEGORIES: NavCategory[] = [
  {
    key: 'lakehouse',
    label: 'Lakehouse',
    icon: 'pi-database',
    defaultExpanded: true,
    items: [
      { segment: 'polaris', icon: 'pi pi-table', brand: siteApachepolaris, label: 'Polaris' },
      { segment: 'trino', icon: 'pi pi-bolt', brand: siTrino, label: 'Trino' },
    ],
  },
  {
    key: 'data-engineering',
    label: 'Data Engineering',
    icon: 'pi-cog',
    defaultExpanded: true,
    items: [
      {
        segment: 'airflow',
        icon: 'pi pi-sitemap',
        brand: siteApacheairflow,
        label: 'Airflow',
      },
      // Single service entry like every other technology: the instance list.
      // The richer Spark Applications view lives in the views world
      // (/projects/:projectId/views), reachable from the sidebar switcher
      // and the user dropdown.
      {
        segment: 'spark/history-server',
        icon: 'pi pi-bolt',
        brand: siApachespark,
        label: 'Spark',
      },
      {
        icon: 'pi pi-share-alt',
        brand: siApachekafka,
        // The Kafka mark is near-black — keep it on the text color so it
        // stays visible in dark mode.
        brandMono: true,
        label: 'Kafka',
        disabled: true,
        defaultHidden: true,
        collapsedTitle: 'Kafka — exploration',
      },
    ],
  },
  {
    key: 'notebooks',
    label: 'Notebooks',
    icon: 'pi-book',
    defaultExpanded: true,
    items: [
      { segment: 'jupyterhub', icon: 'pi pi-desktop', brand: siJupyter, label: 'JupyterHub' },
    ],
  },
  {
    key: 'sql-bi',
    label: 'SQL & BI',
    icon: 'pi-chart-bar',
    defaultExpanded: true,
    items: [
      {
        segment: 'superset',
        icon: 'pi pi-chart-line',
        brand: siApachesuperset,
        label: 'Superset',
      },
      // SQL Lab is not a service: it lives in the views world as a launcher
      // derived from the deployed Superset instance (views-config).
    ],
  },
  {
    key: 'machine-learning',
    label: 'Machine Learning',
    icon: 'pi-microchip',
    defaultExpanded: false,
    items: [
      {
        icon: 'pi pi-sitemap',
        label: 'Kubeflow',
        disabled: true,
        defaultHidden: true,
        collapsedTitle: 'Kubeflow — exploration',
      },
      {
        icon: 'pi pi-flag',
        brand: siMlflow,
        label: 'MLflow',
        disabled: true,
        defaultHidden: true,
        collapsedTitle: 'MLflow — exploration',
      },
      {
        icon: 'pi pi-send',
        label: 'KServe',
        disabled: true,
        defaultHidden: true,
        collapsedTitle: 'KServe — exploration',
      },
    ],
  },
  {
    key: 'project-configuration',
    label: 'Project Panel',
    icon: 'pi-sliders-h',
    defaultExpanded: true,
    fixed: true,
    items: [
      { segment: 'secret-stores', icon: 'pi pi-lock', label: 'Secrets' },
      // Settings also hosts the local-only custom views (custom-views-context).
      { segment: 'settings', icon: 'pi pi-cog', label: 'Settings' },
    ],
  },
];

/** Brand logo when the service has one, primeicons fallback otherwise. */
export function navItemIcon(item: NavItem): React.ReactNode {
  return item.brand ? <BrandIcon icon={item.brand} mono={item.brandMono} /> : item.icon;
}

/** Lateral-menu item for a console segment — lets other surfaces (the views
 *  page and its sidebar) show a service with the same brand logo. */
export function navItemBySegment(segment: string): NavItem | undefined {
  for (const category of NAV_CATEGORIES) {
    const item = category.items.find((i) => i.segment === segment);
    if (item) return item;
  }
  return undefined;
}

/** Normalize a catalog icon (stored as `pi-box` or `pi pi-box`) into a full
 *  primeicons class, falling back to a generic box. */
function catalogIconClass(icon?: string): string {
  if (!icon) return 'pi pi-box';
  return icon.startsWith('pi ') ? icon : `pi ${icon}`;
}

/** Section icon for a NavSection, which prepends `pi ` itself: normalize a
 *  catalog category icon (`pi-cog` or `pi pi-cog`) to its bare `pi-cog` form,
 *  falling back to a generic box. */
function sectionIconClass(icon?: string): string {
  const cls = (icon ?? '').trim();
  if (!cls) return 'pi-box';
  return cls.replace(/^pi\s+/, '');
}

/** SeaweedFS brandmark, hand-vendored (absent from simple-icons): three green
 *  fronds, so the catalog sidebar entry reads on-brand instead of a plain box. */
const siteSeaweedfs: BrandGlyph = {
  viewBox: '0 0 24 24',
  paths: [
    { fill: '#57c98a', d: 'M12 21 Q4.5 16 6.5 7 Q9.5 13 12 21 Z' },
    { fill: '#57c98a', d: 'M12 21 Q19.5 16 17.5 7 Q14.5 13 12 21 Z' },
    { fill: '#2e9e6b', d: 'M12 21 Q8 12 12 3 Q16 12 12 21 Z' },
  ],
};

/** Per-service console presentation, keyed by catalog service name: the display
 *  label and brand logo shown in the sidebar. The catalog drives which services
 *  appear and how they are grouped; this table only supplies the cosmetics for
 *  services that have a bespoke logo, so a freshly-exposed or custom package
 *  still appears (with its catalog icon and the generic /services/<name> route)
 *  without an entry here. The console route is derived from areaBasePath, so
 *  bespoke areas (e.g. spark/history-server) are honored automatically. */
interface ServicePresentation {
  label?: string;
  brand?: BrandGlyph;
  /** Follow text color instead of the brand hex (near-black marks). */
  brandMono?: boolean;
}

const SERVICE_PRESENTATION: Record<string, ServicePresentation> = {
  polaris: { label: 'Polaris', brand: siteApachepolaris },
  trino: { label: 'Trino', brand: siTrino },
  airflow: { label: 'Airflow', brand: siteApacheairflow },
  'spark-history-server': { label: 'Spark', brand: siApachespark },
  jupyterhub: { label: 'JupyterHub', brand: siJupyter },
  superset: { label: 'Superset', brand: siApachesuperset },
  'spark-operator': { brand: siApachespark },
  seaweedfs: { brand: siteSeaweedfs },
};

/** Sidebar entry for a catalog service. Display label precedence: the catalog
 *  `label` (admin-editable), then the bespoke presentation label, then the
 *  service name. Brand logo when known, the catalog icon otherwise; routed to
 *  its bespoke console area (SERVICE_AREAS) or the generic /services/<name>. */
function catalogNavItem(svc: PlatformService): NavItem {
  const presentation = SERVICE_PRESENTATION[svc.name] ?? {};
  return {
    segment: areaBasePath(svc.name).join('/'),
    icon: catalogIconClass(svc.icon),
    brand: presentation.brand,
    brandMono: presentation.brandMono,
    label: svc.label?.trim() || presentation.label || svc.name,
  };
}

/** Build the console sidebar sections from the catalog: every service that
 *  exposes a UI, grouped by its `category` into ordered, labeled sections from
 *  the catalog category metadata, each enriched with its brand logo and bespoke
 *  route when known. Services whose category has no metadata (or none at all)
 *  fall into a trailing "Other services" section, so nothing is ever dropped.
 *  The caller appends the fixed "Project Panel". `isHidden` applies the user's
 *  show/hide preferences. Returns an empty list when the catalog is unavailable,
 *  so the console still renders (with just the fixed section). */
export function catalogConsoleCategories(
  services: PlatformService[],
  categories: MenuCategory[],
  isHidden: (item: NavItem) => boolean = () => false,
): NavCategory[] {
  // Bucket the menu services by category key ('' for uncategorized).
  const itemsByCategory = new Map<string, NavItem[]>();
  for (const svc of services) {
    // exposesUI === false marks an infrastructure-only package (operator,
    // storage backend) with no console page, left out of the navigation.
    if (svc.exposesUI === false) continue;
    const item = catalogNavItem(svc);
    if (isHidden(item)) continue;
    const key = svc.category ?? '';
    const bucket = itemsByCategory.get(key) ?? [];
    bucket.push(item);
    itemsByCategory.set(key, bucket);
  }

  const result: NavCategory[] = [];
  const consumed = new Set<string>();
  // Defined categories first, in their configured order.
  for (const category of [...categories].sort((a, b) => a.order - b.order)) {
    const items = itemsByCategory.get(category.key);
    if (!items || items.length === 0) continue;
    consumed.add(category.key);
    result.push({
      key: category.key,
      label: category.label || category.key,
      icon: sectionIconClass(category.icon),
      defaultExpanded: true,
      items,
    });
  }

  // Uncategorized services, or categories with no metadata, go to "Other services".
  const leftover: NavItem[] = [];
  for (const [key, items] of itemsByCategory) {
    if (!consumed.has(key)) leftover.push(...items);
  }
  if (leftover.length > 0) {
    result.push({
      key: 'catalog-other',
      label: 'Other services',
      icon: 'pi-box',
      defaultExpanded: true,
      items: leftover,
    });
  }
  return result;
}
