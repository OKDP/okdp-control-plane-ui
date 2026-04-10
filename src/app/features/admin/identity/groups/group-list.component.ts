import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MenuModule } from 'primeng/menu';
import { FormsModule } from '@angular/forms';
import { IdentityService, Group } from '../../../../core/services/identity.service';
import { ConfirmationService, MessageService, MenuItem } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    MenuModule,
    FormsModule,
    ConfirmDialogModule,
    ToastModule,
    IconFieldModule,
    InputIconModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './group-list.component.html',
  styleUrls: ['./group-list.component.css']
})
export class GroupListComponent {
  private readonly identityService = inject(IdentityService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  // Consume signal directly from service
  readonly groups = this.identityService.groups;
  readonly loading = this.identityService.groupsLoading;

  groupDialog = false;
  submitted = false;
  isEditMode = false;

  group: Group = { name: '' };
  selectedGroup: Group | null = null;

  menuItems: MenuItem[] = [
    {
      label: 'Edit',
      icon: 'pi pi-pencil',
      command: () => {
        if (this.selectedGroup) {
          this.editGroup(this.selectedGroup);
        }
      }
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        if (this.selectedGroup) {
          this.deleteGroup(this.selectedGroup);
        }
      }
    }
  ];

  openNew() {
    this.group = { name: '' };
    this.submitted = false;
    this.isEditMode = false;
    this.groupDialog = true;
  }

  editGroup(group: Group) {
    this.group = { ...group };
    this.groupDialog = true;
    this.isEditMode = true;
  }

  deleteGroup(group: Group) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete <strong>${group.name}</strong>? This action cannot be undone.`,
      header: 'Delete group?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.identityService.deleteGroup(group.name).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Group deleted' });
            // No manual reload needed - service auto-refreshes
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete group' });
          }
        });
      }
    });
  }

  hideDialog() {
    this.groupDialog = false;
    this.submitted = false;
  }

  saveGroup() {
    this.submitted = true;

    if (this.group.name?.trim()) {
      if (this.isEditMode) {
        this.identityService.updateGroup(this.group.name, this.group).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Group updated' });
            this.hideDialog();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update group' });
          }
        });
      } else {
        this.identityService.createGroup(this.group).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Group created' });
            this.hideDialog();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create group' });
          }
        });
      }
    }
  }
}

