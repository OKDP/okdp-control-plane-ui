import { environment } from '../../config/environment';
import { http } from './http';
import { subscribeJsonStream, type ListEvent, type StreamSubscriber } from './sse';

export interface Project {
  name: string;
  description: string;
}

export type ProjectEvent = ListEvent<Project>;

export type MemberKind = 'user' | 'group';
export type ProjectRole = 'view' | 'edit' | 'admin';

/** A user or a group holding a role on a project, named as in the OIDC token. */
export interface ProjectMember {
  kind: MemberKind;
  name: string;
  role: ProjectRole;
}

export interface ProjectMembers {
  members: ProjectMember[];
  /** Whether the caller may grant and revoke roles on the project. */
  canManage: boolean;
}

const baseUrl = `${environment.apiBaseUrl}/api/projects`;
const seg = encodeURIComponent;

export const projectApi = {
  getProjects(): Promise<Project[]> {
    return http.getList<Project>(baseUrl);
  },

  createProject(project: Project): Promise<Project> {
    return http.post<Project>(baseUrl, project);
  },

  updateProject(project: Project): Promise<Project> {
    return http.put<Project>(`${baseUrl}/${seg(project.name)}`, project);
  },

  deleteProject(name: string): Promise<void> {
    return http.delete(`${baseUrl}/${seg(name)}`);
  },

  getMembers(project: string): Promise<ProjectMembers> {
    return http.get<ProjectMembers>(`${baseUrl}/${seg(project)}/members`);
  },

  /** Gives the member this role, replacing the one it had. */
  setMember(project: string, member: ProjectMember): Promise<ProjectMember> {
    return http.put<ProjectMember>(`${baseUrl}/${seg(project)}/members`, member);
  },

  removeMember(project: string, kind: MemberKind, name: string): Promise<void> {
    return http.delete(`${baseUrl}/${seg(project)}/members?kind=${seg(kind)}&member=${seg(name)}`);
  },

  subscribeProjects(subscriber: StreamSubscriber<ProjectEvent>): () => void {
    return subscribeJsonStream(`${baseUrl}/stream`, subscriber, 'Project SSE');
  },
};
