import type { ReactNode } from 'react';
import { formatCpuCores, formatMemoryBytes } from '../services/service-utils';
import type { ProjectServicesSummary } from './use-project-services-summary';

const ICON_TONES = {
  primary: 'bg-primary-50 text-primary',
  blue: 'bg-accent-blue-light text-accent-blue',
  purple: 'bg-accent-purple-light text-accent-purple',
} as const;

function KpiTile({
  icon,
  tone,
  label,
  value,
}: {
  icon: string;
  tone: keyof typeof ICON_TONES;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-light bg-surface px-4 py-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ICON_TONES[tone]}`}
      >
        <i className={`${icon} text-[1rem]`}></i>
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-xl leading-tight font-semibold text-fg">{value}</span>
        <span className="text-xs text-fg-muted">{label}</span>
      </div>
    </div>
  );
}

/** Global project KPIs shown above the deployed-services table: instance
 *  counts and summed resource usage from the same live summary data. */
export default function ProjectKpis({ summary }: { summary: ProjectServicesSummary }) {
  const { instances, metrics, loaded } = summary;

  const running = instances.filter((i) => i.status === 'Ready' || i.status === 'Running').length;

  let cpu = 0;
  let mem = 0;
  let cpuSeen = false;
  let memSeen = false;
  for (const instance of instances) {
    const m = metrics[instance.name];
    if (m?.cpu?.available) {
      cpu += m.cpu.usedRaw;
      cpuSeen = true;
    }
    if (m?.memory?.available) {
      mem += m.memory.usedRaw;
      memSeen = true;
    }
  }

  const pending = <span className="text-fg-muted">…</span>;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2 max-md:grid-cols-2">
      <KpiTile
        icon="pi pi-server"
        tone="primary"
        label="Instances"
        value={loaded ? instances.length : pending}
      />
      <KpiTile
        icon="pi pi-check-circle"
        tone="blue"
        label="Running"
        value={loaded ? running : pending}
      />
      <KpiTile
        icon="pi pi-microchip"
        tone="purple"
        label="CPU used"
        value={loaded ? (cpuSeen ? formatCpuCores(cpu) : '—') : pending}
      />
      {/* th-large (cell grid) stands in for RAM cells — the database/disk
          icon reads as storage, and primeicons has no dedicated memory
          glyph. Unique to this tile; the chrome no longer uses it. */}
      <KpiTile
        icon="pi pi-th-large"
        tone="blue"
        label="Memory used"
        value={loaded ? (memSeen ? formatMemoryBytes(mem) : '—') : pending}
      />
    </div>
  );
}
