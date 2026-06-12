import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputSwitch } from 'primereact/inputswitch';
import { sparkApi } from '../../../core/api/spark-api';
import type { SparkAppInstance } from '../../../core/models/spark.model';
import { formatMediumDateTime } from '../services/service-utils';
import { StatusTag } from '../../../shared/components/status-tag';
import { getExecutorTone, getStatusTone, isTerminalStatus } from './spark-utils';

export default function SparkDetailPage() {
  const navigate = useNavigate();
  const { projectId = '', appName = '' } = useParams<{ projectId: string; appName: string }>();
  const toast = useRef<Toast>(null);

  const [app, setApp] = useState<SparkAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [logContent, setLogContent] = useState('');
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
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load Spark job details',
        });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, appName]);

  // Driver logs: snapshot fetch or follow-mode stream (starts once the app
  // details have loaded)
  const [logReloadTick, setLogReloadTick] = useState(0);
  const reloadLogs = useCallback(() => setLogReloadTick((t) => t + 1), []);

  useEffect(() => {
    if (!app || !projectId || !appName) return;

    if (followMode) {
      setLogContent('');
      return sparkApi.streamDriverLogs(projectId, appName, {
        next: (line) => setLogContent((current) => current + line + '\n'),
      });
    }

    let cancelled = false;
    sparkApi
      .getDriverLogs(projectId, appName, 200)
      .then((logs) => {
        if (!cancelled) setLogContent(logs);
      })
      .catch(() => {
        if (!cancelled) setLogContent('Failed to load logs.');
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
          window.open(url, '_blank');
        } else {
          toast.current?.show({ severity: 'warn', summary: warnTitle, detail: warnDetail });
        }
      })
      .catch(() => {
        setSparkUILoading(false);
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to retrieve Spark UI info',
        });
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
          <div className="flex animate-in flex-col items-center justify-center gap-3 p-16 text-fg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
              <i className="pi pi-spin pi-spinner text-[1.3rem] text-primary"></i>
            </div>
            <p>Loading job details...</p>
          </div>
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
                  {logContent || 'No logs available.'}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex animate-in flex-col items-center justify-center gap-3 rounded-xl border border-border-light bg-surface p-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-tertiary">
              <i className="pi pi-exclamation-triangle text-[1.5rem] text-fg-muted"></i>
            </div>
            <h3 className="m-0 text-[16px] font-semibold">Job not found</h3>
            <p className="m-0 max-w-[340px] text-[14px] text-fg-secondary">
              The Spark application could not be loaded.
            </p>
            <Button
              icon="pi pi-arrow-left"
              severity="secondary"
              outlined
              label="Back to jobs"
              onClick={goBack}
            />
          </div>
        )}
      </div>
    </>
  );
}
