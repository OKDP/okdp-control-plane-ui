import type { MetricValue } from '../../core/models/service.model';

/** Compact table-cell metric readout: used / limit over a tone-colored usage
 *  bar (the compact version of the detail page's metric card).
 *  `metric` undefined = request still in flight. */
export default function MetricCell({ metric }: { metric: MetricValue | undefined }) {
  if (!metric) {
    return <div className="metric-bar h-[5px] w-[110px] animate-pulse"></div>;
  }
  if (!metric.available) {
    return <span className="text-sm text-fg-muted">—</span>;
  }
  // limitRaw 0 = no limit configured; a bar against 0 would read as exhausted.
  if (metric.limitRaw <= 0) {
    return (
      <span className="text-sm text-fg-secondary">
        {metric.used} <span className="text-xs text-fg-muted">· no limit</span>
      </span>
    );
  }
  const tone = metric.pct > 0.8 ? 'tone-danger' : metric.pct > 0.6 ? 'tone-warn' : '';
  return (
    <div className="flex w-[110px] flex-col gap-1">
      <span className="text-sm text-fg-secondary">
        {metric.used} <span className="text-fg-muted">/ {metric.limit}</span>
      </span>
      <div className="metric-bar h-[5px]">
        <div
          className={`metric-fill ${tone}`}
          // Keep a sliver of fill visible for tiny-but-nonzero usage.
          style={{
            width: `${Math.min(metric.pct, 1) * 100}%`,
            minWidth: metric.usedRaw > 0 ? '3px' : undefined,
          }}
        ></div>
      </div>
    </div>
  );
}
