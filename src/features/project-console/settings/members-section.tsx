import { useCallback, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { apiErrorMessage } from '../../../core/api/http';
import {
  projectApi,
  type MemberKind,
  type ProjectMember,
  type ProjectRole,
} from '../../../core/api/project-api';
import SectionHeading from '../../../shared/components/section-heading';
import { DialogFooter } from '../../../shared/components/dialog-footer';

const ROLE_OPTIONS: { value: ProjectRole; label: string; hint: string }[] = [
  { value: 'view', label: 'Viewer', hint: 'Sees the project and its services.' },
  {
    value: 'edit',
    label: 'Editor',
    hint: 'Also deploys services and manages connections and secrets.',
  },
  { value: 'admin', label: 'Admin', hint: 'Also manages the members and the project.' },
];

const KIND_OPTIONS: { value: MemberKind; label: string }[] = [
  { value: 'group', label: 'Group' },
  { value: 'user', label: 'User' },
];

const roleLabel = (role: ProjectRole) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;

const EMPTY_DRAFT: ProjectMember = { kind: 'group', name: '', role: 'view' };

interface MembersSectionProps {
  projectName: string;
  showSuccess: (detail: string) => void;
  showError: (detail: string) => void;
}

/** Project Settings section listing who holds a role on the project. Admins
 *  of the project grant, change and revoke roles; the others only read. */
export default function MembersSection({
  projectName,
  showSuccess,
  showError,
}: MembersSectionProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectMember | null>(null);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!projectName) return;
    setLoading(true);
    projectApi
      .getMembers(projectName)
      .then((res) => {
        setMembers(res.members ?? []);
        setCanManage(res.canManage);
        setLoadError(null);
      })
      .catch((err) => setLoadError(apiErrorMessage(err, 'The members could not be loaded.')))
      .finally(() => setLoading(false));
  }, [projectName]);

  useEffect(reload, [reload]);

  const save = (member: ProjectMember, done?: () => void) => {
    setBusy(true);
    projectApi
      .setMember(projectName, member)
      .then(() => {
        showSuccess(`${member.name} is now ${roleLabel(member.role)}`);
        done?.();
        reload();
      })
      .catch((err) => showError(apiErrorMessage(err, `Failed to set the role of ${member.name}`)))
      .finally(() => setBusy(false));
  };

  const remove = (member: ProjectMember) => {
    setBusy(true);
    projectApi
      .removeMember(projectName, member.kind, member.name)
      .then(() => {
        showSuccess(`${member.name} removed from the project`);
        setRemoving(null);
        reload();
      })
      .catch((err) => showError(apiErrorMessage(err, `Failed to remove ${member.name}`)))
      .finally(() => setBusy(false));
  };

  const draftValid = !!draft && draft.name.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading>Members</SectionHeading>
      <div className="form-card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-fg">Who can access this project</span>
            <small className="field-hint">
              Users and groups as named by the identity provider. Platform admins have access to
              every project and are not listed.
            </small>
          </div>
          {canManage && (
            <Button
              label="Add member"
              icon="pi pi-plus"
              size="small"
              className="shrink-0"
              onClick={() => setDraft({ ...EMPTY_DRAFT })}
            />
          )}
        </div>

        {loading && members.length === 0 ? (
          <p className="m-0 text-sm text-fg-muted">Loading members…</p>
        ) : loadError ? (
          <p className="m-0 text-sm text-(--db-danger)">{loadError}</p>
        ) : members.length === 0 ? (
          <p className="m-0 text-sm text-fg-muted">No members yet.</p>
        ) : (
          <div className="okdp-table-wrapper">
            <table className="okdp-table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Member</th>
                  <th style={{ width: '35%' }}>Role</th>
                  <th style={{ width: '15%' }}></th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={`${member.kind}/${member.name}`}>
                    <td>
                      <span className="flex items-center gap-2 font-medium text-fg">
                        <i
                          className={`pi ${member.kind === 'group' ? 'pi-users' : 'pi-user'} text-[0.95rem] text-fg-secondary`}
                          title={member.kind === 'group' ? 'Group' : 'User'}
                        ></i>
                        {member.name}
                      </span>
                    </td>
                    <td>
                      {canManage ? (
                        <Dropdown
                          aria-label={`Role of ${member.name}`}
                          value={member.role}
                          options={ROLE_OPTIONS}
                          optionLabel="label"
                          optionValue="value"
                          disabled={busy}
                          onChange={(e) => save({ ...member, role: e.value as ProjectRole })}
                          className="w-40"
                        />
                      ) : (
                        <span className="text-sm text-fg-secondary">{roleLabel(member.role)}</span>
                      )}
                    </td>
                    <td>
                      {canManage && (
                        <div className="okdp-actions">
                          <button
                            className="icon-btn danger"
                            title="Remove"
                            disabled={busy}
                            onClick={() => setRemoving(member)}
                          >
                            <i className="pi pi-trash"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        header="Add member"
        visible={draft !== null}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '480px' }}
        className="db-dialog"
        onHide={() => setDraft(null)}
        footer={
          <DialogFooter
            onCancel={() => setDraft(null)}
            onConfirm={() => draft && draftValid && save(draft, () => setDraft(null))}
            confirmLabel="Add"
            confirmDisabled={!draftValid}
            busy={busy}
          />
        }
      >
        {draft && (
          <div className="dialog-content">
            <div className="field">
              <label htmlFor="member-kind">Type</label>
              <Dropdown
                inputId="member-kind"
                value={draft.kind}
                options={KIND_OPTIONS}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => setDraft((d) => d && { ...d, kind: e.value as MemberKind })}
                className="w-full"
              />
            </div>
            <div className="field">
              <label htmlFor="member-name">Name</label>
              <InputText
                id="member-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })}
                className="w-full dialog-input"
                placeholder={draft.kind === 'group' ? 'e.g., data_scientist' : 'e.g., mark'}
              />
            </div>
            <div className="field">
              <label htmlFor="member-role">Role</label>
              <Dropdown
                inputId="member-role"
                value={draft.role}
                options={ROLE_OPTIONS}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => setDraft((d) => d && { ...d, role: e.value as ProjectRole })}
                className="w-full"
              />
              <small className="field-hint">
                {ROLE_OPTIONS.find((r) => r.value === draft.role)?.hint}
              </small>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        header="Remove this member?"
        visible={removing !== null}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '440px' }}
        className="db-dialog"
        onHide={() => setRemoving(null)}
        footer={
          <DialogFooter
            onCancel={() => setRemoving(null)}
            onConfirm={() => removing && remove(removing)}
            confirmLabel="Remove"
            confirmDanger
            busy={busy}
          />
        }
      >
        {removing && (
          <p className="m-0">
            <strong>{removing.name}</strong> will lose access to <strong>{projectName}</strong>.
          </p>
        )}
      </Dialog>
    </div>
  );
}
