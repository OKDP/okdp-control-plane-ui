import type { ReactNode } from 'react';
import { Button } from 'primereact/button';

interface DialogFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  /** Destructive confirm (Delete) — danger severity. */
  confirmDanger?: boolean;
  /** Shows a spinner on the confirm button and locks both buttons. */
  busy?: boolean;
  cancelDisabled?: boolean;
  /** Extra left-aligned action (e.g. Test Connection). */
  leading?: ReactNode;
}

/** Standard dialog footer: optional leading action, then Cancel → Confirm —
 *  one button order and style for every dialog. */
export function DialogFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  confirmDanger,
  busy,
  cancelDisabled,
  leading,
}: DialogFooterProps) {
  return (
    <div className="dialog-actions items-center">
      {leading}
      {leading && <div className="flex-1"></div>}
      <Button
        severity="secondary"
        outlined
        label="Cancel"
        onClick={onCancel}
        disabled={busy || cancelDisabled}
      />
      <Button
        severity={confirmDanger ? 'danger' : undefined}
        icon={busy ? 'pi pi-spin pi-spinner' : undefined}
        label={confirmLabel}
        disabled={busy || confirmDisabled}
        onClick={onConfirm}
      />
    </div>
  );
}
