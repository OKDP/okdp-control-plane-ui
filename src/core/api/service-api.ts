import { environment } from '../../config/environment';
import { http } from './http';
import { subscribeJsonStream, subscribeTextStream, type StreamSubscriber } from './sse';
import type {
  PlatformService,
  DeployServiceRequest,
  ServiceEvent,
  ServiceInstance,
  Pod,
  ServiceMetrics,
} from '../models/service.model';

const baseUrl = environment.apiBaseUrl;
const seg = encodeURIComponent;

export const serviceApi = {
  // --- Platform services (managed by OKDP) ---

  getPlatformServices(): Promise<PlatformService[]> {
    return http.getList<PlatformService>(`${baseUrl}/api/platform-services`);
  },

  getService(projectId: string, serviceName: string): Promise<ServiceInstance> {
    return http.get<ServiceInstance>(
      `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}`,
    );
  },

  getServices(projectId: string): Promise<ServiceInstance[]> {
    return http.getList<ServiceInstance>(`${baseUrl}/api/projects/${seg(projectId)}/services`);
  },

  deployService(projectId: string, req: DeployServiceRequest): Promise<ServiceInstance> {
    return http.post<ServiceInstance>(`${baseUrl}/api/projects/${seg(projectId)}/services`, req);
  },

  deleteService(projectId: string, serviceName: string): Promise<void> {
    return http.delete(`${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}`);
  },

  subscribeServices(projectId: string, subscriber: StreamSubscriber<ServiceEvent>): () => void {
    return subscribeJsonStream(
      `${baseUrl}/api/projects/${seg(projectId)}/services/stream`,
      subscriber,
      'Service SSE',
    );
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getServiceSchema(serviceName: string, tag?: string): Promise<any> {
    const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return http.get(`${baseUrl}/api/platform-services/${seg(serviceName)}/schema${params}`);
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
      `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}/parameters`,
      body,
    );
  },

  // --- Pod operations ---

  getPods(projectId: string, serviceName: string): Promise<Pod[]> {
    return http.getList<Pod>(
      `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}/pods`,
    );
  },

  getServiceMetrics(projectId: string, serviceName: string): Promise<ServiceMetrics> {
    return http.get<ServiceMetrics>(
      `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}/metrics`,
    );
  },

  getPodLogs(
    projectId: string,
    serviceName: string,
    podName: string,
    tailLines = 100,
    container?: string,
  ): Promise<string> {
    let url = `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}/pods/${seg(podName)}/logs?tailLines=${tailLines}`;
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
    let url = `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}/pods/${seg(podName)}/logs?follow=true&tailLines=${tailLines}`;
    if (container) {
      url += `&container=${encodeURIComponent(container)}`;
    }
    return subscribeTextStream(url, subscriber);
  },
};
