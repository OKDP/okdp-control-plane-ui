import { environment } from '../../config/environment';
import { http } from './http';

export interface User {
  username: string; // ID / Login (metadata.name)
  name: string; // Display Name (spec.name)
  email?: string[];
  comment?: string;
  disabled?: boolean;
  uid?: number;
  groups?: string[];
  password?: string; // Write-only
}

export interface Group {
  name: string;
  comment?: string;
  description?: string;
}

const apiUrl = `${environment.apiBaseUrl}/api/v1/identity`;
const seg = encodeURIComponent;

// CRUD only — the 15s polling/refresh state of the Angular IdentityService
// lives in the admin feature's useIdentity hook.
export const identityApi = {
  listUsers(): Promise<User[]> {
    return http.getList<User>(`${apiUrl}/users`);
  },

  createUser(user: User): Promise<User> {
    return http.post<User>(`${apiUrl}/users`, user);
  },

  updateUser(name: string, user: User): Promise<User> {
    return http.put<User>(`${apiUrl}/users/${seg(name)}`, user);
  },

  deleteUser(name: string): Promise<void> {
    return http.delete(`${apiUrl}/users/${seg(name)}`);
  },

  listGroups(): Promise<Group[]> {
    return http.getList<Group>(`${apiUrl}/groups`);
  },

  createGroup(group: Group): Promise<Group> {
    return http.post<Group>(`${apiUrl}/groups`, group);
  },

  updateGroup(name: string, group: Group): Promise<Group> {
    return http.put<Group>(`${apiUrl}/groups/${seg(name)}`, group);
  },

  deleteGroup(name: string): Promise<void> {
    return http.delete(`${apiUrl}/groups/${seg(name)}`);
  },
};
