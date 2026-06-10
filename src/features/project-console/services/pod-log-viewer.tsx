import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { serviceApi } from '../../../core/api/service-api';
import type { Pod } from '../../../core/models/service.model';
import './pod-log-viewer.css';

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
    <div className="log-viewer">
      <div className="log-toolbar">
        <div className="toolbar-left">
          <i className="pi pi-file icon-file"></i>
          <span className="toolbar-title">Logs</span>
        </div>
        <div className="toolbar-right">
          {podOptions.length > 0 && (
            <Dropdown
              value={selectedPodName}
              options={podOptions}
              optionLabel="label"
              optionValue="value"
              placeholder="Select pod"
              appendTo={document.body}
              className="pod-select"
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
              className="container-select"
              onChange={(e) => setSelectedContainer(e.value)}
            />
          )}

          <label className="follow-toggle">
            <Checkbox
              checked={followMode}
              onChange={(e) => {
                stickToBottomRef.current = true;
                setFollowMode(!!e.checked);
              }}
            />
            <span className="follow-label">Follow</span>
          </label>

          <Button icon="pi pi-download" text rounded onClick={downloadLogs} title="Download logs" />
          {closable && (
            <Button icon="pi pi-times" text rounded onClick={() => onClose?.()} title="Close" />
          )}
        </div>
      </div>

      <div className="log-content" ref={logContainerRef} onScroll={onScroll}>
        {loading ? (
          <div className="log-state">
            <i className="pi pi-spin pi-spinner"></i>
            Loading logs...
          </div>
        ) : lines.length === 0 ? (
          <div className="log-state muted">No logs available.</div>
        ) : (
          <div className="log-lines">
            {lines.map((line, i) => (
              <div key={i} className="log-line">
                <span className="line-no">{formatLineNo(i + 1)}</span>
                <span className="line-text">{line}</span>
              </div>
            ))}
            {followMode && (
              <div className="streaming-row">
                <span className="line-no"></span>
                <span className="streaming-indicator">
                  <span className="dot"></span>
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
