import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Menu } from 'primereact/menu';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import type { MenuItem } from 'primereact/menuitem';
import { projectApi, type Project, type ProjectEvent } from '../../../core/api/project-api';
import { applyListEvent } from '../../../core/api/sse';
import { logger } from '../../../core/services/logger';

export default function ProjectList() {
  const toast = useRef<Toast>(null);
  const menuRef = useRef<Menu>(null);
  const selectedProjectRef = useRef<Project | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  // Mirror of `projects` so the SSE handler can decide on toasts without
  // side effects inside the state updater (updaters must stay pure).
  const projectsRef = useRef<Project[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [visible, setVisible] = useState(false);
  const [newProject, setNewProject] = useState<Project>({ name: '', description: '' });

  const showSuccess = (detail: string) =>
    toast.current?.show({ severity: 'success', summary: 'Success', detail, life: 3000 });

  const showError = (detail: string) =>
    toast.current?.show({ severity: 'error', summary: 'Error', detail, life: 5000 });

  const applyProjects = (next: Project[]) => {
    projectsRef.current = next;
    setProjects(next);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const handleProjectEvent = (event: ProjectEvent) => {
      const project = event.object;
      const exists = projectsRef.current.some((p) => p.name === project.name);

      if (event.type === 'ADDED' && !exists) {
        showSuccess(`Project ${project.name} created`);
      } else if (event.type === 'DELETED' && exists) {
        showSuccess(`Project ${project.name} deleted`);
      }

      applyProjects(applyListEvent(projectsRef.current, event, (p) => p.name));
    };

    projectApi
      .getProjects()
      .then((data) => {
        if (cancelled) return;
        applyProjects(data);
        unsubscribe = projectApi.subscribeProjects({
          next: handleProjectEvent,
          error: (err) => logger.error('Stream error', err),
        });
      })
      .catch(() => showError('Failed to load projects'));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const menuItems: MenuItem[] = [
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        const project = selectedProjectRef.current;
        if (project) {
          confirmDelete(project);
        }
      },
    },
  ];

  const showDialog = () => {
    setNewProject({ name: '', description: '' });
    setVisible(true);
  };

  const createProject = () => {
    projectApi
      .createProject(newProject)
      .then(() => setVisible(false))
      .catch((err) => {
        showError('Failed to create project');
        logger.error('Failed to create project', err);
      });
  };

  const confirmDelete = (project: Project) => {
    confirmDialog({
      message: (
        <span>
          Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be
          undone.
        </span>
      ),
      header: 'Delete project?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        projectApi.deleteProject(project.name).catch(() => showError('Failed to delete project'));
      },
    });
  };

  const dialogFooter = (
    <div className="dialog-actions">
      <Button severity="secondary" outlined label="Cancel" onClick={() => setVisible(false)} />
      <Button disabled={!newProject.name} onClick={createProject} label="Create" />
    </div>
  );

  return (
    <div className="workspace-container">
      {/* Top Bar: Title + Search (Left) | Create Button (Right) */}
      <div className="top-bar">
        <div className="left-group">
          <h1>Projects</h1>
          <IconField>
            <InputIcon className="pi pi-search" />
            <InputText
              type="text"
              placeholder="Filter projects..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </IconField>
        </div>

        <Button label="Create project" onClick={showDialog} className="create-btn" />
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        <DataTable
          value={projects}
          globalFilter={globalFilter}
          globalFilterFields={['name', 'description']}
          className="minimal-table"
          emptyMessage="No projects found."
          rowClassName={() => 'workspace-row'}
        >
          <Column
            header="Name"
            field="name"
            style={{ width: '30%' }}
            body={(project: Project) => <span className="project-name">{project.name}</span>}
          />
          <Column
            header="Description"
            field="description"
            style={{ width: '60%' }}
            className="description-cell"
            body={(project: Project) => project.description || '-'}
          />
          <Column
            style={{ width: '10%', textAlign: 'right' }}
            body={(project: Project) => (
              <div className="actions">
                <Link
                  to={`/project/${project.name}`}
                  className="action-link primary visible-btn"
                  style={{ textDecoration: 'none' }}
                >
                  Open <i className="pi pi-external-link"></i>
                </Link>

                <Button
                  icon="pi pi-ellipsis-v"
                  text
                  rounded
                  onClick={(e) => {
                    selectedProjectRef.current = project;
                    menuRef.current?.toggle(e);
                  }}
                />
              </div>
            )}
          />
        </DataTable>
        <Menu ref={menuRef} model={menuItems} popup appendTo={document.body} />
      </div>

      {/* Create Dialog */}
      <Dialog
        header="Create new project"
        visible={visible}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '600px' }}
        className="db-dialog"
        closable
        onHide={() => setVisible(false)}
        footer={dialogFooter}
      >
        <div className="dialog-content">
          <div className="field">
            <label htmlFor="name">Project name</label>
            <InputText
              id="name"
              value={newProject.name}
              onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
              className="w-full dialog-input"
              placeholder="e.g., analytics-prod"
            />
          </div>

          <div className="field">
            <label htmlFor="description">
              Description <span className="optional">(optional)</span>
            </label>
            <InputTextarea
              id="description"
              value={newProject.description}
              onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
              rows={5}
              className="w-full dialog-input"
              placeholder="Briefly describe the purpose of this project..."
            />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        className="db-confirm-dialog"
        style={{ width: '400px' }}
        acceptClassName="p-button-danger"
        rejectClassName="p-button-text"
      />

      <Toast ref={toast} position="bottom-right" />
    </div>
  );
}
