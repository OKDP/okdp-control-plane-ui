import { useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import type { MenuItem } from 'primereact/menuitem';
import { identityApi, type Group } from '../../../../core/api/identity-api';
import { useIdentityGroups } from '../use-identity';
import './group-list.css';

export function GroupList() {
  const toast = useRef<Toast>(null);
  const menuRef = useRef<Menu>(null);
  const selectedGroupRef = useRef<Group | null>(null);

  const { groups, loading, refresh: refreshGroups } = useIdentityGroups();

  const [globalFilter, setGlobalFilter] = useState('');
  const [groupDialog, setGroupDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [group, setGroup] = useState<Group>({ name: '' });

  const showSuccess = (detail: string) =>
    toast.current?.show({ severity: 'success', summary: 'Success', detail });
  const showError = (detail: string) =>
    toast.current?.show({ severity: 'error', summary: 'Error', detail });

  const openNew = () => {
    setGroup({ name: '' });
    setIsEditMode(false);
    setGroupDialog(true);
  };

  const editGroup = (g: Group) => {
    setGroup({ ...g });
    setIsEditMode(true);
    setGroupDialog(true);
  };

  const deleteGroup = (g: Group) => {
    confirmDialog({
      message: (
        <span>
          Are you sure you want to delete <strong>{g.name}</strong>? This action cannot be undone.
        </span>
      ),
      header: 'Delete group?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        identityApi
          .deleteGroup(g.name)
          .then(() => {
            showSuccess('Group deleted');
            refreshGroups();
          })
          .catch(() => showError('Failed to delete group'));
      },
    });
  };

  const hideDialog = () => setGroupDialog(false);

  const saveGroup = () => {
    if (!group.name?.trim()) {
      return;
    }

    const save = isEditMode
      ? identityApi.updateGroup(group.name, group)
      : identityApi.createGroup(group);

    save
      .then(() => {
        showSuccess(isEditMode ? 'Group updated' : 'Group created');
        refreshGroups();
        hideDialog();
      })
      .catch(() => showError(isEditMode ? 'Failed to update group' : 'Failed to create group'));
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Edit',
      icon: 'pi pi-pencil',
      command: () => {
        if (selectedGroupRef.current) editGroup(selectedGroupRef.current);
      },
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        if (selectedGroupRef.current) deleteGroup(selectedGroupRef.current);
      },
    },
  ];

  const dialogFooter = (
    <div className="dialog-actions">
      <Button severity="secondary" outlined label="Cancel" onClick={hideDialog} />
      <Button disabled={!group.name} onClick={saveGroup} label={isEditMode ? 'Save' : 'Create'} />
    </div>
  );

  return (
    <div className="group-container">
      <Toast ref={toast} />
      <ConfirmDialog
        className="db-confirm-dialog"
        style={{ width: '400px' }}
        acceptClassName="p-button-danger"
        rejectClassName="p-button-text"
      />

      {/* Top Bar */}
      <div className="top-bar">
        <div className="left-group">
          <h1>Groups</h1>
          <IconField>
            <InputIcon className="pi pi-search" />
            <InputText
              type="text"
              placeholder="Filter groups..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </IconField>
        </div>

        <Button label="Create group" onClick={openNew} className="create-btn" />
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        <DataTable
          value={groups}
          loading={loading}
          globalFilter={globalFilter}
          globalFilterFields={['name', 'description']}
          className="minimal-table"
          emptyMessage="No groups found."
          rowClassName={() => 'group-row'}
        >
          <Column
            header="Name"
            field="name"
            style={{ width: '30%' }}
            body={(g: Group) => <span className="group-name">{g.name}</span>}
          />
          <Column
            header="Description"
            field="description"
            style={{ width: '55%' }}
            className="description-cell"
            body={(g: Group) => g.description || '-'}
          />
          <Column
            style={{ width: '15%', textAlign: 'right' }}
            body={(g: Group) => (
              <div className="actions">
                <Button
                  icon="pi pi-ellipsis-v"
                  text
                  rounded
                  onClick={(e) => {
                    selectedGroupRef.current = g;
                    menuRef.current?.toggle(e);
                  }}
                />
              </div>
            )}
          />
        </DataTable>
        <Menu ref={menuRef} model={menuItems} popup appendTo={document.body} />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        header={isEditMode ? 'Edit group' : 'Create new group'}
        visible={groupDialog}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '450px' }}
        className="db-dialog"
        closable
        onHide={hideDialog}
        footer={dialogFooter}
      >
        <div className="dialog-content">
          <div className="field">
            <label htmlFor="name">Group name</label>
            <InputText
              id="name"
              value={group.name}
              onChange={(e) => setGroup((g) => ({ ...g, name: e.target.value }))}
              className="w-full dialog-input"
              placeholder="e.g., developers"
              disabled={isEditMode}
            />
          </div>

          <div className="field">
            <label htmlFor="description">
              Description <span className="optional">(optional)</span>
            </label>
            <InputTextarea
              id="description"
              value={group.description ?? ''}
              onChange={(e) => setGroup((g) => ({ ...g, description: e.target.value }))}
              rows={4}
              className="w-full dialog-input"
              placeholder="Describe the purpose of this group..."
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
