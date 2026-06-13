import { environment } from '../../config/environment';
import { http } from './http';
import { subscribeJsonStream, type ListEvent, type StreamSubscriber } from './sse';

export interface Project {
  name: string;
  description: string;
}

export type ProjectEvent = ListEvent<Project>;

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

  subscribeProjects(subscriber: StreamSubscriber<ProjectEvent>): () => void {
    return subscribeJsonStream(`${baseUrl}/stream`, subscriber, 'Project SSE');
  },
};
