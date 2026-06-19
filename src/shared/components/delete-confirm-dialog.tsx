import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { useConfirmPrefs } from '../../core/preferences/confirm-prefs-context';
import { DialogFooter } from './dialog-footer';

interface DeleteConfirmDialogProps {
  /** Name of the resource being deleted; null hides the dialog. */
  resourceName: string | null;
  /** Lowercase resource kind for the copy (e.g. "project", "instance"). */
  resourceKind: string;
  /** Extra consequence warning rendered above the confirmation input. */
  message?: ReactNode;
  /** Require the typed confirmation regardless of the user preference —
   *  for blast-radius deletions (a whole project). */
  forceTyped?: boolean;
  onHide: () => void;
  onConfirm: (name: string) => void;
}

/** GitHub-style destructive confirmation: the resource name must be typed
 *  (or pasted) before the Delete button arms. The typing step can be turned
 *  off in User Settings, leaving a plain confirm dialog. */
export default function DeleteConfirmDialog({
  resourceName,
  resourceKind,
  message,
  forceTyped,
  onHide,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const { typedDeleteEnabled } = useConfirmPrefs();
  const requireTyped = forceTyped || typedDeleteEnabled;
  const [typed, setTyped] = useState('');

  // Fresh input each time the dialog opens for a (possibly new) resource.
  useEffect(() => setTyped(''), [resourceName]);

  const armed = resourceName !== null && (!requireTyped || typed === resourceName);
  const confirm = () => {
    if (armed && resourceName !== null) onConfirm(resourceName);
  };

  return (
    <Dialog
      header={`Delete this ${resourceKind}?`}
      visible={resourceName !== null}
      modal
      draggable={false}
      resizable={false}
      style={{ width: '460px' }}
      className="db-dialog"
      onHide={onHide}
      footer={
        <DialogFooter
          onCancel={onHide}
          onConfirm={confirm}
          confirmLabel="Delete"
          confirmDanger
          confirmDisabled={!armed}
        />
      }
    >
      <div className="dialog-content">
        {message && <p className="m-0 text-sm text-fg-secondary">{message}</p>}
        {requireTyped && (
          <div className="field">
            <label htmlFor="delete-confirm-input">
              Type <strong className="select-all">{resourceName}</strong> to confirm
            </label>
            <InputText
              id="delete-confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirm();
              }}
              className="w-full dialog-input"
              placeholder={resourceName ?? ''}
              autoFocus
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
