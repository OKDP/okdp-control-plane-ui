interface AlertCopy {
  /** Literal class names, so the stylesheet build sees them. */
  toneClass: 'alert-danger' | 'alert-warn' | 'alert-info';
  icon: string;
  title: string;
  /** Shown when the engine gives no message of its own. */
  fallback: string;
}

function alertCopy(status: string, message?: string): AlertCopy | null {
  switch (status) {
    case 'Ready':
      // A Ready instance shows nothing, unless the engine explains something,
      // such as a change it could not apply while the instance keeps running.
      return message
        ? {
            toneClass: 'alert-warn',
            icon: 'pi pi-exclamation-triangle',
            title: 'Message from the deployment engine',
            fallback: '',
          }
        : null;
    case 'Error':
      return {
        toneClass: 'alert-danger',
        icon: 'pi pi-exclamation-circle',
        title: 'Instance error',
        fallback: 'Check the pod logs for the underlying error.',
      };
    case 'Degraded':
      return {
        toneClass: 'alert-warn',
        icon: 'pi pi-exclamation-triangle',
        title: 'Degraded',
        fallback: 'The deployment engine reports the instance as degraded.',
      };
    case 'Pending':
      return {
        toneClass: 'alert-info',
        icon: 'pi pi-clock',
        title: 'Pending…',
        fallback: 'The deployment engine accepted the change and has not applied it yet.',
      };
    case 'Installing':
      return {
        toneClass: 'alert-warn',
        icon: 'pi pi-spin pi-spinner',
        title: 'Installing…',
        fallback: 'The deployment engine is installing this instance.',
      };
    case 'Updating':
      return {
        toneClass: 'alert-warn',
        icon: 'pi pi-spin pi-spinner',
        title: 'Updating…',
        fallback: 'The deployment engine is rolling out the new configuration.',
      };
    case 'Suspended':
      return {
        toneClass: 'alert-info',
        icon: 'pi pi-pause-circle',
        title: 'Suspended',
        fallback: 'The deployment engine does not reconcile this instance while it is suspended.',
      };
    case 'Deleting':
      return {
        toneClass: 'alert-warn',
        icon: 'pi pi-spin pi-spinner',
        title: 'Deleting…',
        fallback: 'The instance is being removed.',
      };
    case 'Unknown':
      return {
        toneClass: 'alert-info',
        icon: 'pi pi-question-circle',
        title: 'Status unknown',
        fallback: 'The deployment engine cannot observe this instance right now.',
      };
    default:
      return null;
  }
}

/** Banner above an instance's details for any status other than Ready, and
 *  for a Ready one the engine sends a message about. The engine message wins
 *  over the generic text. */
export function InstanceStatusAlert({ status, message }: { status: string; message?: string }) {
  const copy = alertCopy(status, message);
  if (!copy) return null;
  return (
    <div className={`alert ${copy.toneClass}`} role="status">
      <i className={copy.icon}></i>
      <div>
        <strong>{copy.title}</strong>
        {message ? <p className="mono">{message}</p> : <p>{copy.fallback}</p>}
      </div>
    </div>
  );
}
