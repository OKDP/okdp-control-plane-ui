import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '../../../core/auth/auth-context';
import {
  PROJECT_COLOR_PALETTE,
  clearProjectColor,
  getProjectColor,
  setProjectColor,
} from '../../../core/services/project-colors';
import EmptyState from '../../../shared/components/empty-state';

export default function ProjectList() {
  const auth = useAuth();
  const isAdmin = auth.hasRole('admins');
  const toast = useRef<Toast>(null);
  const menuRef = useRef<Menu>(null);
  const selectedProjectRef = useRef<Project | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  // Mirror of `projects` so the SSE handler can decide on toasts without
  // side effects inside the state updater (updaters must stay pure).
  const projectsRef = useRef<Project[]>([]);
  // Deletion runs until the backend's DELETED event removes the row; these
  // names render as "Deleting…" in the meantime.
  const [deletingNames, setDeletingNames] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [visible, setVisible] = useState(false);
  const [newProject, setNewProject] = useState<Project>({ name: '', description: '' });
  const [newColor, setNewColor] = useState<string>(PROJECT_COLOR_PALETTE[0]);

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
        clearProjectColor(project.name);
        setDeletingNames((names) => {
          if (!names.has(project.name)) return names;
          const next = new Set(names);
          next.delete(project.name);
          return next;
        });
      }

      applyProjects(applyListEvent(projectsRef.current, event, (p) => p.name));
    };

    projectApi
      .getProjects()
      .then((data) => {
        if (cancelled) return;
        applyProjects(data);
        setLoaded(true);
        unsubscribe = projectApi.subscribeProjects({
          next: handleProjectEvent,
          error: (err) => logger.error('Stream error', err),
        });
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
        showError('Failed to load projects');
      });

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
    setNewColor(PROJECT_COLOR_PALETTE[0]);
    setVisible(true);
  };

  const createProject = () => {
    // Store the color before the request: the watch ADDED event often beats
    // the HTTP response, and the new row must not flash the fallback color.
    setProjectColor(newProject.name, newColor);
    projectApi
      .createProject(newProject)
      .then(() => setVisible(false))
      .catch((err) => {
        clearProjectColor(newProject.name);
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
        setDeletingNames((names) => new Set(names).add(project.name));
        projectApi.deleteProject(project.name).catch(() => {
          setDeletingNames((names) => {
            const next = new Set(names);
            next.delete(project.name);
            return next;
          });
          showError('Failed to delete project');
        });
      },
    });
  };

  const dialogFooter = (
    <div className="dialog-actions">
      <Button severity="secondary" outlined label="Cancel" onClick={() => setVisible(false)} />
      <Button disabled={!newProject.name} onClick={createProject} label="Create" />
    </div>
  );

  const empty = loaded && projects.length === 0;

  // DataTable memoizes its rows against `value`: the deleting flag must be
  // part of the row objects for the cells to repaint when it flips.
  const rows = useMemo<(Project & { deleting: boolean })[]>(
    () => projects.map((p) => ({ ...p, deleting: deletingNames.has(p.name) })),
    [projects, deletingNames],
  );

  return (
    <div className="workspace-container">
      {/* Top Bar: Title + Search (Left) | Create Button (Right) */}
      <div className="top-bar">
        <div className="left-group">
          <h1>Projects</h1>
          {!empty && (
            <IconField>
              <InputIcon className="pi pi-search" />
              <InputText
                type="text"
                placeholder="Filter projects..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
              />
            </IconField>
          )}
        </div>

        {isAdmin && !empty && (
          <Button label="Create project" onClick={showDialog} className="create-btn" />
        )}
      </div>

      {empty ? (
        /* Getting started: the platform has no project yet. */
        <EmptyState
          icon="pi pi-sparkles"
          title="Welcome to OKDP"
          description={
            isAdmin
              ? 'There is no project on this platform yet. Create your first project to get started.'
              : 'There is no project you can access yet. Ask your platform administrator to create one and grant you access.'
          }
          action={
            isAdmin && (
              <Button
                label="Create your first project"
                icon="pi pi-plus"
                onClick={showDialog}
                className="create-btn mt-3"
              />
            )
          }
        />
      ) : (
        /* Data Table */
        <div className="table-wrapper">
          <DataTable
            value={rows}
            dataKey="name"
            globalFilter={globalFilter}
            globalFilterFields={['name', 'description']}
            className="minimal-table"
            emptyMessage="No projects found."
            rowClassName={(row: Project & { deleting: boolean }) =>
              row.deleting ? 'workspace-row opacity-50' : 'workspace-row'
            }
          >
            <Column
              header="Name"
              field="name"
              style={{ width: '30%' }}
              body={(project: Project) => (
                <span className="project-name flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: getProjectColor(project.name) }}
                  ></span>
                  {project.name}
                </span>
              )}
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
              body={(project: Project & { deleting: boolean }) =>
                project.deleting ? (
                  <div className="actions">
                    <span className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-fg-secondary">
                      <i className="pi pi-spin pi-spinner text-[0.85rem]"></i>
                      Deleting…
                    </span>
                  </div>
                ) : (
                  <div className="actions">
                    <Link
                      to={`/projects/${project.name}`}
                      className="action-link primary visible-btn"
                      style={{ textDecoration: 'none' }}
                    >
                      Open <i className="pi pi-external-link"></i>
                    </Link>

                    {isAdmin && (
                      <Button
                        icon="pi pi-ellipsis-v"
                        text
                        rounded
                        onClick={(e) => {
                          selectedProjectRef.current = project;
                          menuRef.current?.toggle(e);
                        }}
                      />
                    )}
                  </div>
                )
              }
            />
          </DataTable>
          <Menu ref={menuRef} model={menuItems} popup appendTo={document.body} />
        </div>
      )}

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

          <div className="field">
            <label id="project-color-label">
              Color <span className="optional">(only visible to you)</span>
            </label>
            <div
              className="flex items-center gap-2"
              role="radiogroup"
              aria-labelledby="project-color-label"
            >
              {PROJECT_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={newColor === color}
                  aria-label={`Project color ${color}`}
                  className={`h-7 w-7 cursor-pointer rounded-full border-2 transition-transform duration-150 ease-smooth hover:scale-110 ${
                    newColor === color
                      ? 'border-fg ring-2 ring-(--db-primary-200)'
                      : 'border-transparent'
                  }`}
                  style={{ background: color }}
                  onClick={() => setNewColor(color)}
                ></button>
              ))}
            </div>
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
