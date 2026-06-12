import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Dropdown } from 'primereact/dropdown';
import { sqlApi, type SqlQueryResult } from '../../core/api/sql-api';
import { SQL_QUERY_KEY } from '../../core/storage-keys';
import type { ServiceInstance } from '../../core/models/service.model';
import {
  apiErrorMessage,
  isTransitioning,
  statusTone,
} from '../project-console/services/service-utils';
import { PageHeader } from '../../shared/components/page-header';
import { StatusTag } from '../../shared/components/status-tag';
import { SqlEditor } from '../../shared/components/sql-editor';

/** Services the editor can execute SQL on — Trino today, more engines as
 *  the backend proxy learns their protocols. */
const SQL_SERVICES = ['trino'];

const DEFAULT_QUERY = 'SHOW CATALOGS';

function draftKey(projectId: string): string {
  return `${SQL_QUERY_KEY}:${projectId}`;
}

/** Cell text for a Trino JSON value; null renders as a muted marker. */
function cellText(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** /views/sql-editor — built-in view: write SQL and run it on a deployed
 *  engine instance through the control plane's SQL proxy. */
export default function SqlEditorPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { instances, loaded } = useOutletContext<{
    instances: ServiceInstance[];
    loaded: boolean;
  }>() ?? { instances: [], loaded: false };

  const engines = instances.filter((s) => SQL_SERVICES.includes(s.service));
  const [engineName, setEngineName] = useState('');
  const engine =
    engines.find((e) => e.name === engineName) ?? engines.find((e) => e.status === 'Ready') ?? null;

  const [query, setQuery] = useState(
    () => sessionStorage.getItem(draftKey(projectId)) ?? DEFAULT_QUERY,
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [requestError, setRequestError] = useState('');

  const updateQuery = (value: string) => {
    setQuery(value);
    sessionStorage.setItem(draftKey(projectId), value);
  };

  const canRun = !!engine && engine.status === 'Ready' && !!query.trim() && !running;

  const run = () => {
    if (!projectId || !engine || !canRun) return;
    setRunning(true);
    setResult(null);
    setRequestError('');
    sqlApi
      .execute(projectId, engine.name, query.trim())
      .then(setResult)
      .catch((err) => setRequestError(apiErrorMessage(err, 'Failed to execute the query')))
      .finally(() => setRunning(false));
  };

  return (
    <div>
      <PageHeader
        title="SQL Editor"
        subtitle="Write SQL and run it on the project's query engines (Trino)."
      />

      {!loaded ? (
        <div className="empty-state-panel">
          <div className="empty-icon-wrapper">
            <i className="pi pi-spin pi-spinner"></i>
          </div>
          <h3>Loading instances…</h3>
        </div>
      ) : engines.length === 0 ? (
        <div className="empty-state-panel">
          <div className="empty-icon-wrapper">
            <i className="pi pi-database"></i>
          </div>
          <h3>No SQL engine available</h3>
          <p>Deploy a Trino instance in this project to run SQL queries.</p>
          <Link to={`/projects/${projectId}/trino/deploy`} className="create-btn no-underline">
            <i className="pi pi-plus"></i>
            <span>Deploy Trino</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="form-card flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Dropdown
                value={engine?.name ?? null}
                options={engines.map((e) => ({ label: e.name, value: e.name }))}
                onChange={(e) => setEngineName(e.value)}
                placeholder="Select an engine"
                className="min-w-[220px]"
                aria-label="SQL engine instance"
              />
              {engine && (
                <StatusTag
                  value={engine.status}
                  tone={statusTone(engine.status)}
                  pulse={isTransitioning(engine.status)}
                />
              )}
              <div className="flex-1"></div>
              <span className="text-xs text-fg-muted max-md:hidden">Ctrl+Enter to run</span>
              <button className="create-btn" onClick={run} disabled={!canRun}>
                <i className={`pi ${running ? 'pi-spin pi-spinner' : 'pi-play'}`}></i>
                <span>{running ? 'Running…' : 'Run'}</span>
              </button>
            </div>

            <SqlEditor
              value={query}
              onChange={updateQuery}
              onSubmit={run}
              placeholder="SELECT * FROM catalog.schema.table"
              ariaLabel="SQL query"
            />
          </div>

          {requestError && (
            <div className="alert alert-danger">
              <i className="pi pi-times-circle"></i>
              <div>
                <strong>Query failed</strong>
                <p>{requestError}</p>
              </div>
            </div>
          )}

          {result?.error && (
            <div className="alert alert-danger">
              <i className="pi pi-times-circle"></i>
              <div>
                <strong>
                  {result.error.errorName || 'Query error'}
                  {result.error.lineNumber
                    ? ` — line ${result.error.lineNumber}, column ${result.error.columnNumber}`
                    : ''}
                </strong>
                <p>{result.error.message}</p>
              </div>
            </div>
          )}

          {result && !result.error && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-fg-secondary">
                <i className="pi pi-check-circle text-success"></i>
                <span>
                  {result.columns.length > 0
                    ? `${result.rowCount} row${result.rowCount === 1 ? '' : 's'}`
                    : 'Query completed'}
                  {' · '}
                  {result.elapsedMs} ms
                </span>
                {result.truncated && (
                  <span className="okdp-tag okdp-tag-warn">first {result.rowCount} rows</span>
                )}
              </div>

              {result.columns.length > 0 && (
                <div className="okdp-table-wrapper max-h-[480px] overflow-auto">
                  <table className="okdp-table">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        {result.columns.map((col, i) => (
                          <th key={`${col.name}-${i}`} title={col.type}>
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((value, c) => (
                            <td key={c} className="mono text-[12.5px]">
                              {value === null || value === undefined ? (
                                <span className="text-fg-muted italic">null</span>
                              ) : (
                                cellText(value)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {result.rows.length === 0 && (
                        <tr>
                          <td colSpan={result.columns.length} className="text-fg-muted">
                            No rows returned.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
