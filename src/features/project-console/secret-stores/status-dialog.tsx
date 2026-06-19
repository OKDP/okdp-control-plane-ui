import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import type { StatusTone } from '../../../shared/components/status-tag';
import { StatusDetailContent, type StatusDetailLike } from './status-detail';

interface StatusDialogProps {
  visible: boolean;
  selectedName: string;
  loading: boolean;
  detail: StatusDetailLike | null;
  tone: StatusTone;
  /** Label for the timestamp row ("Last checked" / "Last synced"). */
  checkedLabel: string;
  /** Timestamp shown next to checkedLabel (lastCheckedAt / lastSyncedAt). */
  checkedAt?: string;
  onHide: () => void;
  onRefresh: () => void;
}

/** Status-detail dialog shared by the secret store and external secret
 *  lists: Refresh/Close footer around StatusDetailContent. */
export function StatusDialog({
  visible,
  selectedName,
  loading,
  detail,
  tone,
  checkedLabel,
  checkedAt,
  onHide,
  onRefresh,
}: StatusDialogProps) {
  const footer = (
    <div className="dialog-actions items-center">
      <Button
        severity="secondary"
        outlined
        icon="pi pi-refresh"
        label="Refresh"
        onClick={onRefresh}
        disabled={loading}
      />
      <div className="flex-1"></div>
      <Button severity="secondary" outlined label="Close" onClick={onHide} />
    </div>
  );

  return (
    <Dialog
      header={`Status: ${selectedName}`}
      visible={visible}
      modal
      draggable={false}
      resizable={false}
      style={{ width: '600px' }}
      className="db-dialog"
      closable
      onHide={onHide}
      footer={footer}
    >
      <StatusDetailContent
        loading={loading}
        detail={detail}
        tone={tone}
        checkedLabel={checkedLabel}
        checkedAt={checkedAt}
      />
    </Dialog>
  );
}
