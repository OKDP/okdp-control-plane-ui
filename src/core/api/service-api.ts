import { environment } from '../../config/environment';
import { http, invalidateApiCache } from './http';
import { subscribeJsonStream, subscribeTextStream, type StreamSubscriber } from './sse';
import type {
  PlatformService,
  MenuCategory,
  DeployServiceRequest,
  OperationResponse,
  ServiceEvent,
  ServiceInstance,
  ServiceWriteResult,
  ServiceDeleteAnswer,
  Pod,
  ServiceMetrics,
} from '../models/service.model';

const baseUrl = environment.apiBaseUrl;
const seg = encodeURIComponent;

/** Visible ASCII excluding the double quote and comma. Anything else would make
 *  `Headers` throw (control or non Latin-1 characters) or break the tag. */
const ENTITY_TAG_CHARS = /^[\x21\x23-\x2b\x2d-\x7e]+$/;

/** `If-Match` precondition for a write to an instance at `revision`. None when
 *  the revision is unknown or could not travel as one strong entity tag: the
 *  server answers 400 to an empty, weak or multi-valued header. */
function ifMatch(revision: string | undefined): RequestInit | undefined {
  if (!revision || !ENTITY_TAG_CHARS.test(revision)) return undefined;
  return { headers: { 'If-Match': `"${revision}"` } };
}

/** One connection a service's package declares it needs. The deploy form
 *  offers a choice for each entry carrying a parameter. */
export interface PackageInput {
  alias: string;
  contract: string;
  /** Package parameter carrying the chosen connection name. Absent when the
   *  package binds some other way, nothing to choose then. */
  parameter?: string;
  optional: boolean;
  /** Template the package falls back to, rendered against the Environment. Its
   *  presence means "not choosing" is a real answer, not an empty one. */
  default?: string;
  description?: string;
}

export const serviceApi = {
  // --- Platform services (managed by OKDP) ---

  getPlatformServices(): Promise<PlatformService[]> {
    return http.getList<PlatformService>(`${baseUrl}/api/platform-services`);
  },

  getMenuCategories(): Promise<MenuCategory[]> {
    return http.getList<MenuCategory>(`${baseUrl}/api/platform-categories`);
  },

  /** `fresh` skips the short-lived GET cache, for a read triggered by a
   *  change the stream just announced. */
  getService(projectId: string, serviceName: string, fresh = false): Promise<ServiceInstance> {
    return http.get<ServiceInstance>(
      `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}`,
      fresh ? { cache: 'no-store' } : undefined,
    );
  },

  /** Drops the cached reads of a project's instances, so the next visit asks
   *  the server again. */
  forgetServiceReads(projectId: string): void {
    invalidateApiCache(`${baseUrl}/api/projects/${seg(projectId)}/services`);
  },

  getServices(projectId: string): Promise<ServiceInstance[]> {
    return http.getList<ServiceInstance>(`${baseUrl}/api/projects/${seg(projectId)}/services`);
  },

  deployService(projectId: string, req: DeployServiceRequest): Promise<ServiceWriteResult> {
    return http.post<ServiceWriteResult>(`${baseUrl}/api/projects/${seg(projectId)}/services`, req);
  },

  /** `expectedRevision` makes the server refuse (409 conflict) a deletion of
   *  an instance that moved past it. Resolves the status with the engine's
   *  answer when the server sends one. */
  async deleteService(
    projectId: string,
    serviceName: string,
    expectedRevision?: string,
  ): Promise<ServiceDeleteAnswer> {
    const { status, body } = await http.deleteWithStatus<OperationResponse>(
      `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}`,
      ifMatch(expectedRevision),
    );
    return body && typeof body === 'object' ? { status, result: body } : { status };
  },

  subscribeServices(projectId: string, subscriber: StreamSubscriber<ServiceEvent>): () => void {
    return subscribeJsonStream(
      `${baseUrl}/api/projects/${seg(projectId)}/services/stream`,
      subscriber,
      'Service SSE',
    );
  },

  /** Connections the service's package declares it needs at deployment. */
  getServiceInputs(serviceName: string, tag?: string): Promise<PackageInput[]> {
    const query = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return http.getList<PackageInput>(
      `${environment.apiBaseUrl}/api/platform-services/${encodeURIComponent(serviceName)}/inputs${query}`,
    );
  },

  getServiceSchema(serviceName: string, tag?: string): Promise<any> {
    const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return http.get(`${baseUrl}/api/platform-services/${seg(serviceName)}/schema${params}`);
  },

  getProfileImages(): Promise<Record<string, { label: string; image: string }[]>> {
    return http.get(`${baseUrl}/api/profile-images`);
  },

  /** `expectedRevision` makes the server refuse (409 conflict) an update of an
   *  instance that moved past it. */
  updateServiceParameters(
    projectId: string,
    serviceName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { tag?: string; parameters?: Record<string, any> },
    expectedRevision?: string,
  ): Promise<ServiceWriteResult> {
    return http.patch<ServiceWriteResult>(
      `${baseUrl}/api/projects/${seg(projectId)}/services/${seg(serviceName)}/parameters`,
      body,
      ifMatch(expectedRevision),
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

  getProjectMetrics(projectId: string): Promise<Record<string, ServiceMetrics>> {
    return http.get<Record<string, ServiceMetrics>>(
      `${baseUrl}/api/projects/${seg(projectId)}/metrics`,
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
