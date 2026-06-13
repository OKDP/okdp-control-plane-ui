import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { projectApi } from '../../../core/api/project-api';
import { useProjectContext } from '../../../core/context/project-context';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import {
  PROJECT_COLOR_PALETTE,
  getProjectColor,
  setProjectColor,
  useProjectColorsVersion,
} from '../../../core/services/project-colors';
import SectionHeading from '../../../shared/components/section-heading';
import DeleteConfirmDialog from '../../../shared/components/delete-confirm-dialog';
import CustomViewsSection from './custom-views-section';

/** /projects/:projectId/settings — per-project settings: description
 *  update and project deletion (moved here from the former /admin/projects
 *  page, keeping the type-to-confirm dialog). */
export default function ProjectSettingsPage() {
  // The route param is the project name and is available immediately;
  // `currentProject` (the full record) only resolves once the projects
  // list has loaded. Local edits (color, custom views) must key on the
  // param — keying on the not-yet-loaded record stored them under "".
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProject } = useProjectContext();
  const { toast, showSuccess, showError } = useToastMessages();

  const projectName = projectId ?? '';
  const savedDescription = currentProject?.description ?? '';

  const [draft, setDraft] = useState(savedDescription);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-render when the color changes so the selected swatch follows.
  useProjectColorsVersion();
  const currentColor = projectName ? getProjectColor(projectName) : undefined;

  // Re-seed the editor when the selected project changes (the project
  // switcher preserves the /settings sub-route) or when an SSE MODIFIED
  // event delivers a fresh description.
  useEffect(() => {
    setDraft(savedDescription);
  }, [projectName, savedDescription]);

  // The description is "dirty" only when it differs from the saved one —
  // saving an unchanged (or still nonexistent) description must not hit
  // the API.
  const dirty = draft.trim() !== savedDescription.trim();

  const saveDescription = () => {
    if (!dirty || !currentProject) return;
    setSaving(true);
    projectApi
      .updateProject({ name: currentProject.name, description: draft.trim() })
      .then(() => showSuccess('Project description updated'))
      .catch(() => showError('Failed to update the project description'))
      .finally(() => setSaving(false));
  };

  const deleteProject = () => {
    if (!currentProject) return;
    setConfirmDelete(false);
    setDeleting(true);
    // On success the backend's DELETED event removes the project from the
    // context list; the context then navigates away from the dead project.
    projectApi.deleteProject(currentProject.name).catch(() => {
      setDeleting(false);
      showError('Failed to delete the project');
    });
  };

  return (
    <section className="form-page flex animate-[fadeInUp_0.4s_ease-out] flex-col gap-7">
      <div>
        <h1>Project Settings</h1>
        <p className="page-sub mt-1">
          Settings for the <strong>{projectName}</strong> project.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading>Description</SectionHeading>
        <div className="form-card">
          <div className="form-field">
            <label htmlFor="project-description">Project description</label>
            {/* Disabled until the project record loads — typing into the
                not-yet-seeded draft would be clobbered by the re-seed
                effect, and Save would silently no-op. */}
            <InputTextarea
              id="project-description"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoResize
              placeholder="Describe the purpose of this project"
              className="w-full"
              disabled={!currentProject}
            />
            <div className="flex justify-end">
              <Button
                label="Save"
                icon="pi pi-check"
                size="small"
                disabled={!dirty || !currentProject}
                loading={saving}
                onClick={saveDescription}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading>Color</SectionHeading>
        <div className="form-card">
          <div className="form-field">
            <label id="project-color-label">Project color</label>
            <small className="field-hint">
              Shown in the header bar and project lists. Only visible to you; applied immediately.
            </small>
            <div
              className="mt-1 flex items-center gap-2"
              role="radiogroup"
              aria-labelledby="project-color-label"
            >
              {PROJECT_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={currentColor === color}
                  aria-label={`Project color ${color}`}
                  className={`h-7 w-7 cursor-pointer rounded-full border-2 transition-transform duration-150 ease-smooth hover:scale-110 ${
                    currentColor === color
                      ? 'border-fg ring-2 ring-(--db-primary-200)'
                      : 'border-transparent'
                  }`}
                  style={{ background: color }}
                  onClick={() => setProjectColor(projectName, color)}
                ></button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CustomViewsSection projectName={projectName} />

      <div className="flex flex-col gap-3">
        <SectionHeading>Danger zone</SectionHeading>
        <div className="form-card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold text-fg">Delete this project</span>
              <small className="field-hint">
                Removes the project and all its deployed services. This cannot be undone.
              </small>
            </div>
            {deleting ? (
              <span className="flex shrink-0 items-center gap-1.5 px-2 py-1 text-sm font-medium text-fg-secondary">
                <i className="pi pi-spin pi-spinner text-[0.85rem]"></i>
                Deleting…
              </span>
            ) : (
              <Button
                label="Delete"
                icon="pi pi-trash"
                severity="danger"
                outlined
                size="small"
                className="shrink-0"
                disabled={!currentProject}
                onClick={() => setConfirmDelete(true)}
              />
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        resourceName={confirmDelete ? projectName : null}
        resourceKind="project"
        forceTyped
        message={
          confirmDelete && (
            <>
              This will permanently delete <strong>{projectName}</strong> and all its deployed
              services. This cannot be undone.
            </>
          )
        }
        onHide={() => setConfirmDelete(false)}
        onConfirm={deleteProject}
      />

      <Toast ref={toast} position="bottom-right" />
    </section>
  );
}
