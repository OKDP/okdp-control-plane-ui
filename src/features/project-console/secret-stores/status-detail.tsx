import type { ReactNode } from 'react';
import { formatMediumDateTime } from '../services/service-utils';
import { getConditionIcon } from './secret-status';
import { StatusTag, type StatusTone } from '../../../shared/components/status-tag';

export interface ConditionLike {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface StatusDetailLike {
  status: string;
  conditions: ConditionLike[];
  lastError?: string;
}

interface StatusDetailContentProps {
  loading: boolean;
  detail: StatusDetailLike | null;
  tone: StatusTone;
  /** Label for the timestamp row ("Last checked" / "Last synced"). */
  checkedLabel: string;
  /** Timestamp shown next to checkedLabel (lastCheckedAt / lastSyncedAt). */
  checkedAt?: string;
  /** Extra summary rows rendered after the timestamp row. */
  extraRows?: ReactNode;
}

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-[100px] shrink-0 text-[13px] font-semibold text-fg-secondary">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Body of the status dialog shared by the secret store and external secret
 *  lists: summary rows, optional error block and condition cards. */
export function StatusDetailContent({
  loading,
  detail,
  tone,
  checkedLabel,
  checkedAt,
  extraRows,
}: StatusDetailContentProps) {
  return (
    <div className="py-2">
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-fg-secondary">
          <i className="pi pi-spin pi-spinner"></i>
          <span>Loading status...</span>
        </div>
      ) : (
        detail && (
          <>
            <div className="flex flex-col gap-3">
              <StatusRow label="Status">
                <StatusTag value={detail.status} tone={tone} />
              </StatusRow>
              {checkedAt && (
                <StatusRow label={checkedLabel}>
                  <span className="text-[13px] text-fg [word-break:break-word]">
                    {formatMediumDateTime(checkedAt)}
                  </span>
                </StatusRow>
              )}
              {extraRows}
            </div>

            {detail.lastError && (
              <div className="alert-danger mt-4 overflow-hidden rounded-lg border">
                <div className="flex items-center gap-2 border-b border-inherit bg-black/4 px-3 py-2 text-[13px] font-semibold">
                  <i className="pi pi-exclamation-triangle text-[14px]"></i>
                  <span>Error details</span>
                </div>
                <pre className="mono m-0 max-h-[150px] overflow-y-auto p-3 text-[12px] leading-[1.6] whitespace-pre-wrap [word-break:break-word]">
                  {detail.lastError}
                </pre>
              </div>
            )}

            {detail.conditions.length > 0 && (
              <>
                <h4 className="m-0 mt-5 mb-3 text-[14px] font-semibold text-fg">Conditions</h4>
                <div className="flex flex-col gap-2">
                  {detail.conditions.map((cond) => {
                    const ok = cond.status === 'True';
                    return (
                      <div
                        key={cond.type}
                        className="flex flex-col gap-1.5 rounded-lg border border-border-light bg-surface-secondary p-3"
                      >
                        <div className="flex items-center gap-2">
                          <i
                            className={`${getConditionIcon(cond)} shrink-0 text-[16px] ${
                              ok ? 'text-success' : 'text-danger'
                            }`}
                          ></i>
                          <span className="text-[13px] font-semibold text-fg">
                            {cond.type}: {ok ? 'True' : 'False'}
                          </span>
                          {cond.reason && (
                            <StatusTag value={cond.reason} tone={ok ? 'success' : 'danger'} />
                          )}
                        </div>
                        {cond.message && (
                          <pre className="mono m-0 max-h-[120px] overflow-y-auto rounded-xs border border-border-light bg-surface px-2.5 py-2 text-[12px] leading-normal whitespace-pre-wrap text-fg-secondary [word-break:break-word]">
                            {cond.message}
                          </pre>
                        )}
                        {cond.lastTransitionTime && (
                          <span className="pl-6 text-[11px] text-fg-secondary opacity-70">
                            {formatMediumDateTime(cond.lastTransitionTime)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )
      )}
    </div>
  );
}
