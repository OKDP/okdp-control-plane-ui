import { useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Password } from 'primereact/password';
import { MultiSelect } from 'primereact/multiselect';
import { Checkbox } from 'primereact/checkbox';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import type { MenuItem } from 'primereact/menuitem';
import { identityApi, type User } from '../../../../core/api/identity-api';
import { useIdentityGroups, useIdentityUsers } from '../use-identity';
import './user-list.css';

export function UserList() {
  const toast = useRef<Toast>(null);
  const menuRef = useRef<Menu>(null);
  const selectedUserRef = useRef<User | null>(null);

  const { users, loading, refresh: refreshUsers } = useIdentityUsers();
  const { groups: availableGroups } = useIdentityGroups();

  const [globalFilter, setGlobalFilter] = useState('');
  const [userDialog, setUserDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [user, setUser] = useState<User>({ username: '', name: '' });
  const [emailInput, setEmailInput] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const showSuccess = (detail: string) =>
    toast.current?.show({ severity: 'success', summary: 'Success', detail });
  const showError = (detail: string) =>
    toast.current?.show({ severity: 'error', summary: 'Error', detail });

  const openNew = () => {
    setUser({ username: '', name: '', disabled: false });
    setEmailInput('');
    setSelectedGroups([]);
    setIsEditMode(false);
    setUserDialog(true);
  };

  const editUser = (u: User) => {
    setUser({ ...u, password: '' });
    setEmailInput(u.email ? u.email.join(', ') : '');
    setSelectedGroups(u.groups || []);
    setIsEditMode(true);
    setUserDialog(true);
  };

  const deleteUser = (u: User) => {
    confirmDialog({
      message: (
        <span>
          Are you sure you want to delete <strong>{u.name}</strong>? This action cannot be undone.
        </span>
      ),
      header: 'Delete user?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        identityApi
          .deleteUser(u.username)
          .then(() => {
            showSuccess('User deleted');
            refreshUsers();
          })
          .catch(() => showError('Failed to delete user'));
      },
    });
  };

  const hideDialog = () => setUserDialog(false);

  const saveUser = () => {
    if (!user.username?.trim()) {
      return;
    }

    const payload: User = {
      ...user,
      email: emailInput.trim() ? emailInput.split(',').map((e) => e.trim()) : [],
      groups: selectedGroups,
    };

    const save = isEditMode
      ? identityApi.updateUser(payload.username, payload)
      : identityApi.createUser(payload);

    save
      .then(() => {
        showSuccess(isEditMode ? 'User updated' : 'User created');
        refreshUsers();
        hideDialog();
      })
      .catch(() => showError(isEditMode ? 'Failed to update user' : 'Failed to create user'));
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Edit',
      icon: 'pi pi-pencil',
      command: () => {
        if (selectedUserRef.current) editUser(selectedUserRef.current);
      },
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        if (selectedUserRef.current) deleteUser(selectedUserRef.current);
      },
    },
  ];

  const dialogFooter = (
    <div className="dialog-actions">
      <Button severity="secondary" outlined label="Cancel" onClick={hideDialog} />
      <Button
        disabled={!user.name || !user.username}
        onClick={saveUser}
        label={isEditMode ? 'Save' : 'Create'}
      />
    </div>
  );

  return (
    <div className="user-container">
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
          <h1>Users</h1>
          <IconField>
            <InputIcon className="pi pi-search" />
            <InputText
              type="text"
              placeholder="Filter users..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </IconField>
        </div>

        <Button label="Create user" onClick={openNew} className="create-btn" />
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        <DataTable
          value={users}
          loading={loading}
          globalFilter={globalFilter}
          globalFilterFields={['name', 'email']}
          className="minimal-table"
          emptyMessage="No users found."
          rowClassName={() => 'user-row'}
        >
          <Column
            header="Name"
            field="name"
            style={{ width: '20%' }}
            body={(u: User) => (
              <div className="user-info">
                <span className="user-name">{u.name}</span>
              </div>
            )}
          />
          <Column
            header="Email"
            style={{ width: '25%' }}
            className="email-cell"
            body={(u: User) => u.email?.join(', ') || '-'}
          />
          <Column
            header="Groups"
            style={{ width: '25%' }}
            body={(u: User) => (
              <div className="groups-list">
                {u.groups?.slice(0, 3).map((group) => (
                  <span key={group} className="group-badge">
                    {group}
                  </span>
                ))}
                {(u.groups?.length ?? 0) > 3 && (
                  <span className="group-more">+{u.groups!.length - 3}</span>
                )}
              </div>
            )}
          />
          <Column
            header="Status"
            style={{ width: '15%' }}
            body={(u: User) =>
              u.disabled ? (
                <span className="status-badge disabled">Disabled</span>
              ) : (
                <span className="status-badge active">Active</span>
              )
            }
          />
          <Column
            style={{ width: '15%', textAlign: 'right' }}
            body={(u: User) => (
              <div className="actions">
                <Button
                  icon="pi pi-ellipsis-v"
                  text
                  rounded
                  onClick={(e) => {
                    selectedUserRef.current = u;
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
        header={isEditMode ? 'Edit user' : 'Create new user'}
        visible={userDialog}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '500px' }}
        className="db-dialog"
        closable
        onHide={hideDialog}
        footer={dialogFooter}
      >
        <div className="dialog-content">
          <div className="field">
            <label htmlFor="username">Username</label>
            <InputText
              id="username"
              value={user.username}
              onChange={(e) => setUser((u) => ({ ...u, username: e.target.value }))}
              className="w-full dialog-input"
              placeholder="e.g., john.doe"
              disabled={isEditMode}
            />
          </div>

          <div className="field">
            <label htmlFor="name">Display Name</label>
            <InputText
              id="name"
              value={user.name}
              onChange={(e) => setUser((u) => ({ ...u, name: e.target.value }))}
              className="w-full dialog-input"
              placeholder="e.g., John Doe"
            />
          </div>

          <div className="field">
            <label htmlFor="email">
              Email <span className="optional">(comma-separated for multiple)</span>
            </label>
            <InputText
              id="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full dialog-input"
              placeholder="e.g., john@example.com"
            />
          </div>

          <div className="field">
            <label htmlFor="password">
              Password{' '}
              {isEditMode && <span className="optional">(leave empty to keep current)</span>}
            </label>
            <Password
              value={user.password ?? ''}
              onChange={(e) => setUser((u) => ({ ...u, password: e.target.value }))}
              toggleMask
              feedback={false}
              className="w-full"
            />
          </div>

          <div className="field">
            <label htmlFor="groups">Groups</label>
            <MultiSelect
              options={availableGroups}
              value={selectedGroups}
              onChange={(e) => setSelectedGroups(e.value)}
              optionLabel="name"
              optionValue="name"
              placeholder="Select groups"
              style={{ width: '100%' }}
              appendTo={document.body}
              display="chip"
            />
          </div>

          <div className="field">
            <label htmlFor="comment">
              Comment <span className="optional">(optional)</span>
            </label>
            <InputTextarea
              id="comment"
              value={user.comment ?? ''}
              onChange={(e) => setUser((u) => ({ ...u, comment: e.target.value }))}
              rows={3}
              className="w-full dialog-input"
              placeholder="Add a note about this user..."
            />
          </div>

          <div className="field-checkbox">
            <Checkbox
              checked={!!user.disabled}
              onChange={(e) => setUser((u) => ({ ...u, disabled: !!e.checked }))}
              inputId="disabled"
            />
            <label htmlFor="disabled">Disable account</label>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
