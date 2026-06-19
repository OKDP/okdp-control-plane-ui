import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputSwitch } from 'primereact/inputswitch';
import { sparkApi } from '../../../core/api/spark-api';
import type { SparkAppInstance } from '../../../core/models/spark.model';
import { formatMediumDateTime, openInNewTab } from '../services/service-utils';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import EmptyState from '../../../shared/components/empty-state';
import { StatusTag } from '../../../shared/components/status-tag';
import { getExecutorTone, getStatusTone, isTerminalStatus } from './spark-utils';

const MAX_LOG_LINES = 10000;

export default function SparkDetailPage() {
  const navigate = useNavigate();
  const { projectId = '', appName = '' } = useParams<{ projectId: string; appName: string }>();
  const { toast, showError, showWarn } = useToastMessages();

  const [app, setApp] = useState<SparkAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [followMode, setFollowMode] = useState(false);
  const [sparkUILoading, setSparkUILoading] = useState(false);

  useEffect(() => {
    if (!projectId || !appName) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    sparkApi
      .getApp(projectId, appName)
      .then((data) => {
        if (cancelled) return;
        setApp(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        showError('Failed to load Spark job details');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, appName, showError]);

  // Driver logs: snapshot fetch or follow-mode stream (starts once the app
  // details have loaded)
  const [logReloadTick, setLogReloadTick] = useState(0);
  const reloadLogs = useCallback(() => setLogReloadTick((t) => t + 1), []);

  useEffect(() => {
    if (!app || !projectId || !appName) return;

    if (followMode) {
      setLogLines([]);
      return sparkApi.streamDriverLogs(projectId, appName, {
        next: (line) =>
          setLogLines((prev) => {
            const next = [...prev, line];
            if (next.length > MAX_LOG_LINES) {
              next.splice(0, next.length - MAX_LOG_LINES);
            }
            return next;
          }),
      });
    }

    let cancelled = false;
    sparkApi
      .getDriverLogs(projectId, appName, 200)
      .then((logs) => {
        if (!cancelled) setLogLines(logs ? [logs] : []);
      })
      .catch(() => {
        if (!cancelled) setLogLines(['Failed to load logs.']);
      });
    return () => {
      cancelled = true;
    };
  }, [app, projectId, appName, followMode, logReloadTick]);

  const openSparkLink = (
    field: 'uiAddress' | 'historyServerUrl',
    warnTitle: string,
    warnDetail: string,
  ) => {
    if (!projectId) return;
    setSparkUILoading(true);
    sparkApi
      .getSparkUI(projectId, appName)
      .then((info) => {
        setSparkUILoading(false);
        const url = info[field];
        if (url) {
          openInNewTab(url);
        } else {
          showWarn(warnDetail, warnTitle);
        }
      })
      .catch(() => {
        setSparkUILoading(false);
        showError('Failed to retrieve Spark UI info');
      });
  };

  const goBack = () => {
    if (projectId) {
      navigate(`/projects/${projectId}/views/spark/applications`);
    }
  };

  const executors = app?.executors ?? {};
  const executorKeys = Object.keys(executors);

  return (
    <>
      <Toast ref={toast} />

      <div className="mx-auto max-w-[960px] pt-3">
        <div className="mb-5 animate-in">
          <nav className="breadcrumb">
            <a
              className="breadcrumb-link"
              onClick={goBack}
              onKeyDown={(e) => e.key === 'Enter' && goBack()}
              tabIndex={0}
            >
              <i className="pi pi-arrow-left text-[11px]"></i>
              Spark Jobs
            </a>
            <i className="pi pi-angle-right text-[10px] text-fg-muted"></i>
            <span className="breadcrumb-current">{app?.name}</span>
          </nav>
          <div className="header-row">
            <div className="header-badge amber">
              <i className="pi pi-bolt"></i>
            </div>
            <div className="header-text">
              <div className="header-title-row">
                <h2>{app?.name}</h2>
                {app && (
                  <StatusTag
                    value={app.status}
                    tone={getStatusTone(app.status)}
                    pulse={app.status === 'RUNNING'}
                  />
                )}
              </div>
              <p className="page-desc">
                {app?.type} · {app?.mode}
              </p>
            </div>
            <div className="header-actions">
              {app?.status === 'RUNNING' ? (
                <Button
                  icon="pi pi-external-link"
                  label="Spark UI"
                  severity="info"
                  outlined
                  size="small"
                  loading={sparkUILoading}
                  onClick={() =>
                    openSparkLink(
                      'uiAddress',
                      'Spark UI unavailable',
                      'The live driver UI is not available yet.',
                    )
                  }
                />
              ) : (
                app &&
                isTerminalStatus(app.status) && (
                  <Button
                    icon="pi pi-history"
                    label="History Server"
                    severity="secondary"
                    outlined
                    size="small"
                    loading={sparkUILoading}
                    onClick={() =>
                      openSparkLink(
                        'historyServerUrl',
                        'History Server unavailable',
                        'The Spark History Server URL could not be resolved.',
                      )
                    }
                  />
                )
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <EmptyState variant="panel" icon="pi pi-spin pi-spinner" title="Loading job details..." />
        ) : app ? (
          <div className="flex animate-[fadeInUp_0.45s_cubic-bezier(0.22,1,0.36,1)_0.08s_backwards] flex-col gap-5">
            <div className="rounded-xl border border-border-light bg-surface p-5">
              <div className="grid grid-cols-2 gap-x-7 gap-y-3 max-md:grid-cols-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium tracking-[0.05em] text-fg-muted uppercase">
                    Name
                  </span>
                  <span className="text-[14px] font-medium text-fg">{app.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium tracking-[0.05em] text-fg-muted uppercase">
                    Type
                  </span>
                  <span className="text-[14px] font-medium text-fg">{app.type}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium tracking-[0.05em] text-fg-muted uppercase">
                    Image
                  </span>
                  <span className="text-[13px] font-medium text-fg mono">{app.image}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium tracking-[0.05em] text-fg-muted uppercase">
                    Created
                  </span>
                  <span className="text-[14px] font-medium text-fg">
                    {formatMediumDateTime(app.createdAt)}
                  </span>
                </div>
                {app.driverPodName && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium tracking-[0.05em] text-fg-muted uppercase">
                      Driver Pod
                    </span>
                    <span className="text-[13px] font-medium text-fg mono">
                      {app.driverPodName}
                    </span>
                  </div>
                )}
                {app.errorMessage && (
                  <div className="col-span-full flex flex-col gap-1">
                    <span className="text-[12px] font-medium tracking-[0.05em] text-fg-muted uppercase">
                      Error
                    </span>
                    <span className="text-[14px] font-medium text-accent-red">
                      {app.errorMessage}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {executorKeys.length > 0 && (
              <div className="rounded-xl border border-border-light bg-surface p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-purple-light">
                    <i className="pi pi-objects-column text-[1rem] text-accent-purple"></i>
                  </div>
                  <h3 className="m-0 flex-1 text-[16px] font-bold tracking-[-0.02em] text-fg">
                    Executors
                  </h3>
                </div>
                <div className="flex flex-col">
                  {executorKeys.map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between border-b border-b-border-light py-2 last:border-b-0"
                    >
                      <span className="text-[13px] font-medium text-fg mono">{key}</span>
                      <StatusTag
                        value={executors[key]}
                        tone={getExecutorTone(executors[key])}
                        pulse={executors[key] === 'RUNNING'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border-light bg-surface p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50">
                  <i className="pi pi-file-edit text-[1rem] text-primary"></i>
                </div>
                <h3 className="m-0 flex-1 text-[16px] font-bold tracking-[-0.02em] text-fg">
                  Driver Logs
                </h3>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[13px] text-fg-secondary">
                    <InputSwitch checked={followMode} onChange={(e) => setFollowMode(!!e.value)} />
                    <span>Follow</span>
                  </label>
                  <Button
                    icon="pi pi-refresh"
                    text
                    rounded
                    onClick={reloadLogs}
                    title="Refresh logs"
                  />
                </div>
              </div>
              <div className="log-block max-h-[500px] overflow-auto rounded-md p-3">
                <pre className="m-0 font-[inherit] break-all whitespace-pre-wrap">
                  {logLines.join('\n') || 'No logs available.'}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            variant="panel"
            icon="pi pi-exclamation-triangle"
            title="Job not found"
            description="The Spark application could not be loaded."
            action={
              <Button
                icon="pi pi-arrow-left"
                severity="secondary"
                outlined
                label="Back to jobs"
                onClick={goBack}
              />
            }
          />
        )}
      </div>
    </>
  );
}
