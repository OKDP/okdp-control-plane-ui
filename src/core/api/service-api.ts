import { environment } from '../../config/environment';
import { http } from './http';
import { subscribeJsonStream, subscribeTextStream, type StreamSubscriber } from './sse';
import type {
  PlatformService,
  DeployServiceRequest,
  ServiceEvent,
  ServiceInstance,
  CatalogCategory,
  Pod,
  ServiceMetrics,
} from '../models/service.model';

const baseUrl = environment.apiBaseUrl;

export const serviceApi = {
  // --- Platform services (managed by OKDP) ---

  async getPlatformServices(): Promise<PlatformService[]> {
    return (await http.get<PlatformService[]>(`${baseUrl}/api/platform-services`)) || [];
  },

  getService(projectId: string, serviceName: string): Promise<ServiceInstance> {
    return http.get<ServiceInstance>(
      `${baseUrl}/api/projects/${projectId}/services/${serviceName}`,
    );
  },

  async getServices(projectId: string): Promise<ServiceInstance[]> {
    return (
      (await http.get<ServiceInstance[]>(`${baseUrl}/api/projects/${projectId}/services`)) || []
    );
  },

  deployService(projectId: string, req: DeployServiceRequest): Promise<ServiceInstance> {
    return http.post<ServiceInstance>(`${baseUrl}/api/projects/${projectId}/services`, req);
  },

  deleteService(projectId: string, serviceName: string): Promise<void> {
    return http.delete(`${baseUrl}/api/projects/${projectId}/services/${serviceName}`);
  },

  subscribeServices(projectId: string, subscriber: StreamSubscriber<ServiceEvent>): () => void {
    return subscribeJsonStream(
      `${baseUrl}/api/projects/${projectId}/services/stream`,
      subscriber,
      'Service SSE',
    );
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getServiceSchema(serviceName: string, tag?: string): Promise<any> {
    const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return http.get(`${baseUrl}/api/platform-services/${serviceName}/schema${params}`);
  },

  getProfileImages(): Promise<Record<string, { label: string; image: string }[]>> {
    return http.get(`${baseUrl}/api/profile-images`);
  },

  updateServiceParameters(
    projectId: string,
    serviceName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { tag?: string; parameters?: Record<string, any> },
  ): Promise<ServiceInstance> {
    return http.patch<ServiceInstance>(
      `${baseUrl}/api/projects/${projectId}/services/${serviceName}/parameters`,
      body,
    );
  },

  // --- Pod operations ---

  async getPods(projectId: string, serviceName: string): Promise<Pod[]> {
    return (
      (await http.get<Pod[]>(
        `${baseUrl}/api/projects/${projectId}/services/${serviceName}/pods`,
      )) || []
    );
  },

  getServiceMetrics(projectId: string, serviceName: string): Promise<ServiceMetrics> {
    return http.get<ServiceMetrics>(
      `${baseUrl}/api/projects/${projectId}/services/${serviceName}/metrics`,
    );
  },

  getPodLogs(
    projectId: string,
    serviceName: string,
    podName: string,
    tailLines = 100,
    container?: string,
  ): Promise<string> {
    let url = `${baseUrl}/api/projects/${projectId}/services/${serviceName}/pods/${podName}/logs?tailLines=${tailLines}`;
    if (container) {
      url += `&container=${encodeURIComponent(container)}`;
    }
    return http.getText(url);
  },

  streamPodLogs(
    projectId: string,
    serviceName: string,
    podName: string,
    subscriber: StreamSubscriber<string>,
    container?: string,
    tailLines = 100,
  ): () => void {
    let url = `${baseUrl}/api/projects/${projectId}/services/${serviceName}/pods/${podName}/logs?follow=true&tailLines=${tailLines}`;
    if (container) {
      url += `&container=${encodeURIComponent(container)}`;
    }
    return subscribeTextStream(url, subscriber);
  },

  // --- Catalog (client self-service) ---

  async getCatalog(): Promise<CatalogCategory[]> {
    return (await http.get<CatalogCategory[]>(`${baseUrl}/api/catalog`)) || [];
  },
};
