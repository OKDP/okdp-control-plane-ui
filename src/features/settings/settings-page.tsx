import { InputSwitch } from 'primereact/inputswitch';
import { useTheme, type ThemeMode } from '../../core/theme/theme-context';
import { useEnvBar } from '../../core/preferences/env-bar-context';
import { useNavPrefs, type NavMenuSize } from '../../core/preferences/nav-prefs-context';
import { useConfirmPrefs } from '../../core/preferences/confirm-prefs-context';
import { NAV_CATEGORIES } from '../project-console/nav-config';
import SectionHeading from '../../shared/components/section-heading';

interface PreviewPalette {
  bg: string;
  chrome: string;
  border: string;
  line: string;
  accent: string;
}

const LIGHT_PALETTE: PreviewPalette = {
  bg: '#ffffff',
  chrome: '#f6f8fa',
  border: '#d0d7de',
  line: '#d8dee4',
  accent: '#3b82f6',
};

const DARK_PALETTE: PreviewPalette = {
  bg: '#0d1117',
  chrome: '#161b22',
  border: '#30363d',
  line: '#30363d',
  accent: '#4493f8',
};

/** Skeleton console mock (header, sidebar, content lines) painted with one
 *  theme's palette — the GitHub-appearance-settings preview equivalent. */
function MiniPreview({ dark }: { dark: boolean }) {
  const c = dark ? DARK_PALETTE : LIGHT_PALETTE;
  return (
    <div className="h-full w-full" style={{ background: c.bg }}>
      <div
        className="flex h-5 items-center gap-1.5 px-2"
        style={{ background: c.chrome, borderBottom: `1px solid ${c.border}` }}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.accent }}></span>
        <span className="h-1.5 w-10 rounded-sm" style={{ background: c.line }}></span>
      </div>
      <div className="flex h-[calc(100%-1.25rem)]">
        <div
          className="flex w-11 shrink-0 flex-col gap-1.5 p-2"
          style={{ background: c.chrome, borderRight: `1px solid ${c.border}` }}
        >
          <span className="h-1.5 w-full rounded-sm" style={{ background: c.accent }}></span>
          <span className="h-1.5 w-full rounded-sm" style={{ background: c.line }}></span>
          <span className="h-1.5 w-3/4 rounded-sm" style={{ background: c.line }}></span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-2">
          <span className="h-2 w-1/2 rounded-sm" style={{ background: c.line }}></span>
          <span className="h-1.5 w-full rounded-sm" style={{ background: c.line }}></span>
          <span className="h-1.5 w-full rounded-sm" style={{ background: c.line }}></span>
          <span className="h-1.5 w-2/3 rounded-sm" style={{ background: c.line }}></span>
        </div>
      </div>
    </div>
  );
}

/** System mode preview: light on the left half, dark on the right. */
function SplitPreview() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <MiniPreview dark={false} />
      </div>
      <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-[200%]">
          <MiniPreview dark />
        </div>
      </div>
    </div>
  );
}

interface ThemeCardProps {
  mode: ThemeMode;
  label: string;
  description: string;
  icon: string;
}

function ThemeCard({ mode, label, description, icon }: ThemeCardProps) {
  const { theme, setTheme } = useTheme();
  const selected = theme === mode;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => setTheme(mode)}
      className={`flex w-[230px] cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-surface p-0 text-left transition-[border-color,box-shadow] duration-150 ease-smooth ${
        selected
          ? 'border-primary ring-2 ring-(--db-primary-200)'
          : 'border-border-light hover:border-fg-muted'
      }`}
    >
      <div className="pointer-events-none h-[120px] w-full" aria-hidden="true">
        {mode === 'system' ? <SplitPreview /> : <MiniPreview dark={mode === 'dark'} />}
      </div>
      <div className="flex items-center gap-2 border-t border-border-light px-3 py-2.5">
        <i className={`${icon} text-[0.85rem] text-fg-muted`}></i>
        <div className="flex flex-col">
          <span className="text-sm leading-tight font-semibold text-fg">{label}</span>
          <span className="text-xs text-fg-muted">{description}</span>
        </div>
        {selected && <i className="pi pi-check-circle ml-auto text-[0.95rem] text-primary"></i>}
      </div>
    </button>
  );
}

const SIZE_OPTIONS: { value: NavMenuSize; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra large' },
];

interface SizeSegmentsProps {
  value: NavMenuSize;
  onChange: (size: NavMenuSize) => void;
  ariaLabel: string;
}

/** Compact → Extra large segmented control — same raised-segment idiom as
 *  the sidebar's world switcher. */
function SizeSegments({ value, onChange, ariaLabel }: SizeSegmentsProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex shrink-0 gap-0.5 rounded-md border border-border-light bg-surface-secondary p-0.5"
    >
      {SIZE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-[7px] border-0 px-2.5 py-1 text-sm ${
              active
                ? 'bg-surface font-semibold text-fg shadow-xs'
                : 'bg-transparent font-medium text-fg-muted transition-colors duration-150 ease-smooth hover:bg-surface hover:text-fg'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Size of the menu entries — one choice covering both the expanded
 *  sidebar and the collapsed rail. */
function NavSizePrefs() {
  const { menuSize, setMenuSize } = useNavPrefs();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[12.5px] font-semibold text-fg">Menu size</span>
        <small className="field-hint">
          Text and icon size of the menu entries, expanded or collapsed.
        </small>
      </div>
      <SizeSegments value={menuSize} onChange={setMenuSize} ariaLabel="Lateral menu size" />
    </div>
  );
}

/** Per-category groups of lateral-menu entries with show/hide switches.
 *  Core entries (the world switcher, Project Panel) are not listed: they
 *  always stay in the menu. */
function NavMenuPrefs() {
  const { isNavItemHidden, setNavItemHidden } = useNavPrefs();

  return (
    <div className="flex flex-col gap-5">
      {NAV_CATEGORIES.filter((category) => !category.fixed).map((category) => (
        <div
          key={category.key}
          className="flex flex-col gap-3 border-t border-border-light pt-5 first:border-t-0 first:pt-0"
        >
          <span className="flex items-center gap-2 text-[12.5px] font-semibold text-fg">
            <i className={`pi ${category.icon} text-[0.85rem] text-fg-muted`}></i>
            {category.label}
          </span>
          {category.items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4">
              <label htmlFor={`nav-item-${item.label}`} className="text-sm text-fg-secondary">
                {item.label}
                {item.disabled && <span className="ml-1.5 text-xs text-fg-muted">(preview)</span>}
              </label>
              <InputSwitch
                inputId={`nav-item-${item.label}`}
                checked={!isNavItemHidden(item.label, item.defaultHidden)}
                onChange={(e) => setNavItemHidden(item.label, !(e.value ?? false))}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** /settings — personal preferences for the console. */
export default function SettingsPage() {
  const { envBarEnabled, setEnvBarEnabled } = useEnvBar();
  const { typedDeleteEnabled, setTypedDeleteEnabled } = useConfirmPrefs();
  return (
    <section className="form-page flex animate-[fadeInUp_0.4s_ease-out] flex-col gap-7">
      <div>
        <h1>User Settings</h1>
        <p className="page-sub mt-1">
          Personal preferences for the OKDP console. They only apply to this browser.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading>Theme</SectionHeading>
        <div className="form-card">
          <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-4">
            <ThemeCard
              mode="system"
              label="Sync with system"
              description="Follows your OS appearance"
              icon="pi pi-desktop"
            />
            <ThemeCard mode="light" label="Light" description="Always light" icon="pi pi-sun" />
            <ThemeCard mode="dark" label="Dark" description="Always dark" icon="pi pi-moon" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading>Environment</SectionHeading>
        <div className="form-card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="env-bar-switch" className="text-[12.5px] font-semibold text-fg">
                Environment color bar
              </label>
              <small className="field-hint">
                Paint the selected project&apos;s color as a strip across the top banner.
              </small>
            </div>
            <InputSwitch
              inputId="env-bar-switch"
              checked={envBarEnabled}
              onChange={(e) => setEnvBarEnabled(e.value ?? false)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading>Confirmations</SectionHeading>
        <div className="form-card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="typed-delete-switch" className="text-[12.5px] font-semibold text-fg">
                Type-to-confirm deletions
              </label>
              <small className="field-hint">
                Require typing the resource name before deleting an instance. Deleting a whole
                project always requires it.
              </small>
            </div>
            <InputSwitch
              inputId="typed-delete-switch"
              checked={typedDeleteEnabled}
              onChange={(e) => setTypedDeleteEnabled(e.value ?? true)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading>Lateral menu</SectionHeading>
        <div className="form-card flex flex-col gap-5">
          <NavSizePrefs />
          <div className="flex flex-col gap-3 border-t border-border-light pt-5">
            <small className="field-hint">
              Choose which services appear in the project lateral menu.
            </small>
            <NavMenuPrefs />
          </div>
        </div>
      </div>
    </section>
  );
}
