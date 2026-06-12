import { environment } from '../../config/environment';
import { http } from './http';
import { subscribeJsonStream, type StreamSubscriber } from './sse';

export interface Project {
  name: string;
  description: string;
}

export interface ProjectEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: Project;
}

const baseUrl = `${environment.apiBaseUrl}/api/projects`;

export const projectApi = {
  async getProjects(): Promise<Project[]> {
    return (await http.get<Project[]>(baseUrl)) || [];
  },

  createProject(project: Project): Promise<Project> {
    return http.post<Project>(baseUrl, project);
  },

  updateProject(project: Project): Promise<Project> {
    return http.put<Project>(`${baseUrl}/${project.name}`, project);
  },

  deleteProject(name: string): Promise<void> {
    return http.delete(`${baseUrl}/${name}`);
  },

  subscribeProjects(subscriber: StreamSubscriber<ProjectEvent>): () => void {
    return subscribeJsonStream(`${baseUrl}/stream`, subscriber, 'Project SSE');
  },
};
