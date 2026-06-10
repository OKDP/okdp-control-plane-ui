import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import type { Pod } from '../../../core/models/service.model';
import './pod-list.css';

function getStatusSeverity(
  status: string,
): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | undefined {
  switch (status) {
    case 'Running':
      return 'success';
    case 'Succeeded':
      return 'info';
    case 'Pending':
      return 'warning';
    case 'Failed':
    case 'Error':
      return 'danger';
    default:
      return 'secondary';
  }
}

export interface PodListProps {
  pods: Pod[];
  onViewLogs: (pod: Pod) => void;
}

export function PodList({ pods, onViewLogs }: PodListProps) {
  return (
    <DataTable
      value={pods}
      rowHover
      className="minimal-table"
      dataKey="name"
      emptyMessage={
        <div className="empty-state-inline">
          <i className="pi pi-box"></i>
          No pods found for this instance.
        </div>
      }
    >
      <Column
        header="Pod"
        style={{ width: '35%' }}
        body={(pod: Pod) => <span className="pod-name">{pod.name}</span>}
      />
      <Column
        header="Status"
        style={{ width: '15%' }}
        body={(pod: Pod) => <Tag value={pod.status} severity={getStatusSeverity(pod.status)} />}
      />
      <Column header="Ready" field="ready" style={{ width: '10%' }} />
      <Column header="Restarts" field="restarts" style={{ width: '10%' }} />
      <Column header="Age" field="age" style={{ width: '10%' }} />
      <Column
        style={{ width: '20%', textAlign: 'right' }}
        body={(pod: Pod) => (
          <button className="logs-btn" title="View pod logs" onClick={() => onViewLogs(pod)}>
            <i className="pi pi-file"></i> Logs
          </button>
        )}
      />
    </DataTable>
  );
}
