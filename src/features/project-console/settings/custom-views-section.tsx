import { useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useCustomViews, type CustomView } from '../../../core/preferences/custom-views-context';
import SectionHeading from '../../../shared/components/section-heading';
import { NAV_CATEGORIES } from '../nav-config';
import { DialogFooter } from '../../../shared/components/dialog-footer';

/** Curated primeicons palette for the tile icon picker. */
const ICON_CHOICES = [
  'pi pi-globe',
  'pi pi-link',
  'pi pi-chart-line',
  'pi pi-chart-bar',
  'pi pi-database',
  'pi pi-table',
  'pi pi-book',
  'pi pi-code',
  'pi pi-bolt',
  'pi pi-eye',
  // pi-map, not pi-compass: the compass is the chrome's Views glyph.
  'pi pi-map',
  'pi pi-wrench',
];

type Draft = Omit<CustomView, 'id'> & { id?: string };

const EMPTY_DRAFT: Draft = {
  label: '',
  url: '',
  description: '',
  icon: ICON_CHOICES[0],
  category: '',
  inMenu: true,
};

function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url.trim());
}

/** Project Settings section for user-created views: launcher tiles
 *  (URL, description, icon) shown on the views page and, when flagged, in
 *  the views sidebar under their category. Stored in this browser only —
 *  the API is not involved and other users never see them. */
export default function CustomViewsSection({ projectName }: { projectName: string }) {
  const { viewsFor, addView, updateView, removeView } = useCustomViews();
  const views = projectName ? viewsFor(projectName) : [];

  const [draft, setDraft] = useState<Draft | null>(null);
  const valid =
    !!draft &&
    draft.label.trim().length > 0 &&
    isValidUrl(draft.url) &&
    draft.category.trim().length > 0;

  // Suggested categories: the lateral menu's own (Project Panel is fixed
  // console chrome, not a views group) plus names already in use.
  const categoryOptions = [
    ...NAV_CATEGORIES.filter((c) => !c.fixed).map((c) => c.label),
    ...new Set(views.map((v) => v.category)),
  ].filter((label, i, all) => all.indexOf(label) === i);

  const openCreate = () => setDraft({ ...EMPTY_DRAFT });
  const openEdit = (view: CustomView) => setDraft({ ...view });

  const save = () => {
    if (!projectName || !draft || !valid) return;
    const view = {
      ...draft,
      label: draft.label.trim(),
      url: draft.url.trim(),
      description: draft.description?.trim() || undefined,
      category: draft.category.trim(),
    };
    if (view.id) {
      updateView(projectName, view as CustomView);
    } else {
      addView(projectName, view);
    }
    setDraft(null);
  };

  const confirmRemove = (view: CustomView) =>
    confirmDialog({
      message: `Remove the "${view.label}" view? Only this browser is affected.`,
      header: 'Remove custom view',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      acceptLabel: 'Remove',
      accept: () => removeView(projectName, view.id),
    });

  const dialogFooter = (
    <DialogFooter
      onCancel={() => setDraft(null)}
      onConfirm={save}
      confirmLabel={draft?.id ? 'Save' : 'Create'}
      confirmDisabled={!valid}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading>Custom views</SectionHeading>
      <div className="form-card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-fg">Personal launcher tiles</span>
            <small className="field-hint">
              Shown on the views page and, with a category, in the views menu. Stored in this
              browser only — other users don&apos;t see them.
            </small>
          </div>
          <Button
            label="New view"
            icon="pi pi-plus"
            size="small"
            className="shrink-0"
            onClick={openCreate}
          />
        </div>

        {views.length === 0 ? (
          <p className="m-0 text-sm text-fg-muted">
            No custom views yet — a Grafana dashboard, a wiki page, any URL.
          </p>
        ) : (
          <div className="okdp-table-wrapper">
            <table className="okdp-table">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Name</th>
                  <th style={{ width: '28%' }}>URL</th>
                  <th style={{ width: '14%' }}>Category</th>
                  <th style={{ width: '20%' }}>Description</th>
                  <th style={{ width: '8%' }}>In menu</th>
                  <th style={{ width: '10%' }}></th>
                </tr>
              </thead>
              <tbody>
                {views.map((view) => (
                  <tr key={view.id}>
                    <td>
                      <span className="flex items-center gap-2 font-medium text-fg">
                        <i className={`${view.icon} text-[0.95rem] text-fg-secondary`}></i>
                        {view.label}
                      </span>
                    </td>
                    <td>
                      <a
                        href={view.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mono text-sm break-all text-primary no-underline hover:underline"
                      >
                        {view.url}
                      </a>
                    </td>
                    <td>
                      <span className="text-sm text-fg-secondary">{view.category}</span>
                    </td>
                    <td>
                      <span className="muted-text">{view.description || '—'}</span>
                    </td>
                    <td>
                      {view.inMenu ? (
                        <i
                          className="pi pi-check text-sm text-(--db-success)"
                          title="Shown in the views menu"
                        ></i>
                      ) : (
                        <span className="muted-text">—</span>
                      )}
                    </td>
                    <td>
                      <div className="okdp-actions">
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(view)}>
                          <i className="pi pi-pencil"></i>
                        </button>
                        <button
                          className="icon-btn danger"
                          title="Remove"
                          onClick={() => confirmRemove(view)}
                        >
                          <i className="pi pi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        className="db-confirm-dialog"
        style={{ width: '400px' }}
        acceptClassName="p-button-danger"
        rejectClassName="p-button-text"
      />
      <Dialog
        header={draft?.id ? 'Edit custom view' : 'New custom view'}
        visible={draft !== null}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '560px' }}
        className="db-dialog"
        closable
        onHide={() => setDraft(null)}
        footer={dialogFooter}
      >
        {draft && (
          <div className="dialog-content">
            <div className="field">
              <label htmlFor="cv-name">Name</label>
              <InputText
                id="cv-name"
                value={draft.label}
                onChange={(e) => setDraft((d) => d && { ...d, label: e.target.value })}
                className="w-full dialog-input"
                placeholder="e.g., Grafana"
              />
            </div>

            <div className="field">
              <label htmlFor="cv-url">URL</label>
              <InputText
                id="cv-url"
                value={draft.url}
                onChange={(e) => setDraft((d) => d && { ...d, url: e.target.value })}
                className="w-full dialog-input"
                placeholder="https://…"
              />
              {draft.url.trim() !== '' && !isValidUrl(draft.url) && (
                <small className="text-sm text-(--db-danger)">
                  Must be an http:// or https:// URL.
                </small>
              )}
            </div>

            <div className="field">
              <label htmlFor="cv-desc">
                Description <span className="optional">(optional)</span>
              </label>
              <InputText
                id="cv-desc"
                value={draft.description ?? ''}
                onChange={(e) => setDraft((d) => d && { ...d, description: e.target.value })}
                className="w-full dialog-input"
                placeholder="Shown on the tile"
              />
            </div>

            <div className="field">
              <label htmlFor="cv-category">Category</label>
              <Dropdown
                inputId="cv-category"
                editable
                options={categoryOptions}
                value={draft.category}
                onChange={(e) =>
                  setDraft((d) => d && { ...d, category: (e.value as string) ?? '' })
                }
                className="w-full"
                placeholder="Pick a menu category or type a new one"
              />
            </div>

            <div className="field">
              <label id="cv-icon-label">Icon</label>
              <div
                className="flex flex-wrap items-center gap-2"
                role="radiogroup"
                aria-labelledby="cv-icon-label"
              >
                {ICON_CHOICES.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    role="radio"
                    aria-checked={draft.icon === icon}
                    aria-label={`Icon ${icon.replace('pi pi-', '')}`}
                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border transition-colors duration-150 ease-smooth ${
                      draft.icon === icon
                        ? 'border-primary bg-primary-50 text-primary'
                        : 'border-border-light bg-surface text-fg-secondary hover:border-border'
                    }`}
                    onClick={() => setDraft((d) => d && { ...d, icon })}
                  >
                    <i className={`${icon} text-[1rem]`}></i>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-checkbox">
              <Checkbox
                inputId="cv-in-menu"
                checked={draft.inMenu}
                onChange={(e) => setDraft((d) => d && { ...d, inMenu: !!e.checked })}
              />
              <label htmlFor="cv-in-menu">Show in the views lateral menu</label>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
