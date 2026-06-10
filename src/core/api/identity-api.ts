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

// CRUD only — the 15s polling/refresh state of the Angular IdentityService
// lives in the admin feature's useIdentity hook.
export const identityApi = {
  async listUsers(): Promise<User[]> {
    return (await http.get<User[]>(`${apiUrl}/users`)) || [];
  },

  getUser(name: string): Promise<User> {
    return http.get<User>(`${apiUrl}/users/${name}`);
  },

  createUser(user: User): Promise<User> {
    return http.post<User>(`${apiUrl}/users`, user);
  },

  updateUser(name: string, user: User): Promise<User> {
    return http.put<User>(`${apiUrl}/users/${name}`, user);
  },

  deleteUser(name: string): Promise<void> {
    return http.delete(`${apiUrl}/users/${name}`);
  },

  async listGroups(): Promise<Group[]> {
    return (await http.get<Group[]>(`${apiUrl}/groups`)) || [];
  },

  createGroup(group: Group): Promise<Group> {
    return http.post<Group>(`${apiUrl}/groups`, group);
  },

  updateGroup(name: string, group: Group): Promise<Group> {
    return http.put<Group>(`${apiUrl}/groups/${name}`, group);
  },

  deleteGroup(name: string): Promise<void> {
    return http.delete(`${apiUrl}/groups/${name}`);
  },
};
