import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { InputSwitch } from 'primereact/inputswitch';
import { sparkApi } from '../../../core/api/spark-api';
import type { SparkAppInstance } from '../../../core/models/spark.model';
import { formatMediumDateTime } from '../services/service-utils';
import { getExecutorSeverity, getStatusSeverity, isTerminalStatus } from './spark-utils';
import './spark-pages.css';

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
      navigate(`/project/${projectId}/spark/applications`);
    }
  };

  const executors = app?.executors ?? {};
  const executorKeys = Object.keys(executors);

  return (
    <>
      <Toast ref={toast} />

      <div className="spark-page detail-page">
        <div className="page-header animate-in">
          <nav className="breadcrumb">
            <a
              className="breadcrumb-link"
              onClick={goBack}
              onKeyDown={(e) => e.key === 'Enter' && goBack()}
              tabIndex={0}
            >
              <i className="pi pi-arrow-left breadcrumb-back-icon"></i>
              Spark Jobs
            </a>
            <i className="pi pi-angle-right breadcrumb-sep"></i>
            <span className="breadcrumb-current">{app?.name}</span>
          </nav>
          <div className="header-row">
            <div className="header-badge">
              <i className="pi pi-bolt"></i>
            </div>
            <div className="header-text">
              <div className="header-title-row">
                <h2>{app?.name}</h2>
                {app && <Tag value={app.status} severity={getStatusSeverity(app.status)} />}
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
          <div className="loading-state animate-in">
            <div className="loading-spinner-ring">
              <i className="pi pi-spin pi-spinner"></i>
            </div>
            <p>Loading job details...</p>
          </div>
        ) : app ? (
          <div className="detail-content animate-in">
            <div className="info-card">
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Name</span>
                  <span className="info-value">{app.name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Type</span>
                  <span className="info-value">{app.type}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Image</span>
                  <span className="info-value mono">{app.image}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Created</span>
                  <span className="info-value">{formatMediumDateTime(app.createdAt)}</span>
                </div>
                {app.driverPodName && (
                  <div className="info-item">
                    <span className="info-label">Driver Pod</span>
                    <span className="info-value mono">{app.driverPodName}</span>
                  </div>
                )}
                {app.errorMessage && (
                  <div className="info-item full-width">
                    <span className="info-label">Error</span>
                    <span className="info-value error-text">{app.errorMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {executorKeys.length > 0 && (
              <div className="section-card">
                <div className="section-header">
                  <div className="section-icon-badge executors">
                    <i className="pi pi-objects-column"></i>
                  </div>
                  <h3 className="section-title">Executors</h3>
                </div>
                <div className="executor-list">
                  {executorKeys.map((key) => (
                    <div key={key} className="executor-row">
                      <span className="executor-name">{key}</span>
                      <Tag value={executors[key]} severity={getExecutorSeverity(executors[key])} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="section-card">
              <div className="section-header">
                <div className="section-icon-badge logs">
                  <i className="pi pi-file-edit"></i>
                </div>
                <h3 className="section-title">Driver Logs</h3>
                <div className="log-controls">
                  <label className="follow-label">
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
              <div className="log-viewer">
                <pre className="log-content">{logContent || 'No logs available.'}</pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state animate-in">
            <div className="empty-icon-wrapper">
              <i className="pi pi-exclamation-triangle empty-icon"></i>
            </div>
            <h3>Job not found</h3>
            <p>The Spark application could not be loaded.</p>
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
