import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { PasswordModule } from 'primeng/password';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { MenuModule } from 'primeng/menu';
import { FormsModule } from '@angular/forms';
import { IdentityService, User } from '../../../../core/services/identity.service';
import { ConfirmationService, MessageService, MenuItem } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    PasswordModule,
    MultiSelectModule,
    CheckboxModule,
    TagModule,
    MenuModule,
    FormsModule,
    ConfirmDialogModule,
    ToastModule,
    IconFieldModule,
    InputIconModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent {
  private readonly identityService = inject(IdentityService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  // Consume signals directly from service
  readonly users = this.identityService.users;
  readonly availableGroups = this.identityService.groups;
  readonly loading = this.identityService.usersLoading;

  userDialog = false;
  submitted = false;
  isEditMode = false;

  user: User = { username: '', name: '' };
  emailInput = '';
  selectedGroups: string[] = [];
  selectedUser: User | null = null;

  menuItems: MenuItem[] = [
    {
      label: 'Edit',
      icon: 'pi pi-pencil',
      command: () => {
        if (this.selectedUser) {
          this.editUser(this.selectedUser);
        }
      }
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        if (this.selectedUser) {
          this.deleteUser(this.selectedUser);
        }
      }
    }
  ];

  openNew() {
    this.user = { username: '', name: '', disabled: false };
    this.emailInput = '';
    this.selectedGroups = [];
    this.submitted = false;
    this.isEditMode = false;
    this.userDialog = true;
  }

  editUser(user: User) {
    this.user = { ...user, password: '' };
    this.emailInput = user.email ? user.email.join(', ') : '';
    this.selectedGroups = user.groups || [];
    this.userDialog = true;
    this.isEditMode = true;
  }

  deleteUser(user: User) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete <strong>${user.name} </strong>? This action cannot be undone.`,
      header: 'Delete user?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.identityService.deleteUser(user.username).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'User deleted' });
            // No need to manually reload - service auto-refreshes
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete user' });
          }
        });
      }
    });
  }


  hideDialog() {
    this.userDialog = false;
    this.submitted = false;
  }

  saveUser() {
    this.submitted = true;

    if (this.user.username?.trim()) {
      if (this.emailInput && this.emailInput.trim()) {
        this.user.email = this.emailInput.split(',').map(e => e.trim());
      } else {
        this.user.email = [];
      }

      this.user.groups = this.selectedGroups;

      if (this.isEditMode) {
        this.identityService.updateUser(this.user.username, this.user).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'User updated' });
            this.hideDialog();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update user' });
          }
        });
      } else {
        this.identityService.createUser(this.user).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'User created' });
            this.hideDialog();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create user' });
          }
        });
      }
    }
  }
}

