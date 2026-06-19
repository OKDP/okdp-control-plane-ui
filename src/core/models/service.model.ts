import type { ListEvent } from '../api/sse';

// --- Platform Services (core OKDP, full lifecycle management) ---

export interface PlatformService {
  name: string;
  versions: string[];
  defaultVersion: string;
  description: string;
  icon?: string;
  category?: string;
}

export interface DeployServiceRequest {
  service: string;
  tag?: string;
  instanceName?: string;
  parameters: Record<string, unknown>;
}

export interface ServiceInstance {
  name: string;
  releaseName: string;
  service: string;
  serviceTag: string;
  status: string;
  /**
   * Human-readable explanation set by the backend when status is not
   * "Ready". Typically the latest K8s Warning event in the namespace
   * (e.g. a Helm upgrade failure or an invalid resource parameter).
   */
  statusMessage?: string;
  targetNamespace: string;
  url?: string;
  parameters: Record<string, unknown>;
  createdAt?: string;
}

export type ServiceEvent = ListEvent<ServiceInstance>;

export interface Pod {
  name: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  containers: PodContainer[];
}

export interface PodContainer {
  name: string;
  image: string;
  ready: boolean;
}

export interface MetricValue {
  usedRaw: number;
  limitRaw: number;
  used: string;
  limit: string;
  pct: number;
  available: boolean;
}

export interface ServiceMetrics {
  cpu: MetricValue;
  memory: MetricValue;
}
