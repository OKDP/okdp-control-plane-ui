import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { serviceApi } from '../../../core/api/service-api';
import type { Pod } from '../../../core/models/service.model';

const MAX_LOG_LINES = 10000;
const AUTOSCROLL_THRESHOLD_PX = 40;

export interface PodLogViewerProps {
  projectId: string;
  serviceName: string;
  pods: Pod[];
  initialPodName?: string;
  closable?: boolean;
  onClose?: () => void;
}

export function PodLogViewer({
  projectId,
  serviceName,
  pods,
  initialPodName,
  closable = false,
  onClose,
}: PodLogViewerProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPodName, setSelectedPodName] = useState('');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [followMode, setFollowMode] = useState(true);

  const podOptions = useMemo(() => pods.map((p) => ({ label: p.name, value: p.name })), [pods]);

  const containerOptions = useMemo(() => {
    const pod = pods.find((p) => p.name === selectedPodName);
    return (pod?.containers ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [pods, selectedPodName]);

  // Adopt incoming pods / initial pod selection (ngOnChanges port)
  useEffect(() => {
    const requested =
      initialPodName && pods.find((p) => p.name === initialPodName) ? initialPodName : null;
    const current = pods.find((p) => p.name === selectedPodName);

    if (requested && requested !== selectedPodName) {
      setSelectedPodName(requested);
    } else if (!current && pods.length > 0) {
      setSelectedPodName(pods[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pods, initialPodName]);

  // Default to the first container when the pod changes; keep the user's
  // selection when a pods refresh re-creates the same options.
  useEffect(() => {
    setSelectedContainer((current) =>
      current && containerOptions.some((o) => o.value === current)
        ? current
        : (containerOptions[0]?.value ?? ''),
    );
  }, [containerOptions]);

  // Load or stream logs whenever the selection or mode changes
  useEffect(() => {
    if (!selectedPodName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLines([]);

    if (followMode) {
      return serviceApi.streamPodLogs(
        projectId,
        serviceName,
        selectedPodName,
        {
          next: (line) => {
            setLines((prev) => {
              const next = [...prev, line];
              if (next.length > MAX_LOG_LINES) {
                next.splice(0, next.length - MAX_LOG_LINES);
              }
              return next;
            });
            setLoading(false);
          },
          complete: () => setLoading(false),
        },
        selectedContainer || undefined,
        200,
      );
    }

    let cancelled = false;
    serviceApi
      .getPodLogs(projectId, serviceName, selectedPodName, 500, selectedContainer || undefined)
      .then((text) => {
        if (cancelled) return;
        setLines(text ? text.split('\n').filter((l) => l.length > 0) : []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLines(['Failed to load logs.']);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, serviceName, selectedPodName, selectedContainer, followMode]);

  // Keep the view pinned to the bottom while new lines stream in
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = logContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  const onScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= AUTOSCROLL_THRESHOLD_PX;
  };

  const formatLineNo = (n: number) => String(n).padStart(3, '0');

  const downloadLogs = () => {
    const content = lines.join('\n');
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPodName || 'pod'}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-light bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light bg-surface-secondary px-4 py-3">
        <div className="flex items-center gap-2.5">
          <i className="pi pi-file text-[16px] text-primary"></i>
          <span className="text-[14px] font-semibold text-fg">Logs</span>
        </div>
        <div className="flex items-center gap-2.5">
          {podOptions.length > 0 && (
            <Dropdown
              value={selectedPodName}
              options={podOptions}
              optionLabel="label"
              optionValue="value"
              placeholder="Select pod"
              appendTo={document.body}
              className="min-w-[180px]"
              onChange={(e) => setSelectedPodName(e.value)}
            />
          )}

          {containerOptions.length > 1 && (
            <Dropdown
              value={selectedContainer}
              options={containerOptions}
              optionLabel="label"
              optionValue="value"
              placeholder="Container"
              appendTo={document.body}
              className="min-w-[180px]"
              onChange={(e) => setSelectedContainer(e.value)}
            />
          )}

          <label className="flex cursor-pointer items-center gap-1.5 select-none">
            <Checkbox
              checked={followMode}
              onChange={(e) => {
                stickToBottomRef.current = true;
                setFollowMode(!!e.checked);
              }}
            />
            <span className="text-[13px] font-medium text-fg-secondary">Follow</span>
          </label>

          <Button icon="pi pi-download" text rounded onClick={downloadLogs} title="Download logs" />
          {closable && (
            <Button icon="pi pi-times" text rounded onClick={() => onClose?.()} title="Close" />
          )}
        </div>
      </div>

      <div
        className="max-h-[520px] min-h-[320px] overflow-auto bg-[#111827] text-[12.5px] leading-[1.7] text-[#e5e7eb] [font-family:'JetBrains_Mono','Fira_Code',Consolas,monospace]"
        ref={logContainerRef}
        onScroll={onScroll}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-14 text-[13px] text-[#9ca3af]">
            <i className="pi pi-spin pi-spinner text-[16px]"></i>
            Loading logs...
          </div>
        ) : lines.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-14 text-[13px] text-[#6b7280]">
            No logs available.
          </div>
        ) : (
          <div className="py-3">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-4 px-4 break-all whitespace-pre-wrap hover:bg-white/3">
                <span className="min-w-8 shrink-0 text-right text-[#6b7280] select-none">
                  {formatLineNo(i + 1)}
                </span>
                <span className="flex-1 text-[#e5e7eb]">{line}</span>
              </div>
            ))}
            {followMode && (
              <div className="flex gap-4 px-4 pt-1.5 pb-0.5">
                <span className="min-w-8 shrink-0 text-right select-none"></span>
                <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[#10b981]">
                  <span className="h-2 w-2 animate-log-pulse rounded-full bg-[#10b981] shadow-[0_0_0_0_rgba(16,185,129,0.5)]"></span>
                  streaming
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
