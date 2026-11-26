import type { ListEvent } from '../api/sse';

// --- Platform Services (core OKDP, full lifecycle management) ---

export interface PlatformService {
  name: string;
  versions: string[];
  defaultVersion: string;
  description: string;
  icon?: string;
  category?: string;
  // Per-service package repository override (defaults to the Context's global
  // packageRepository when empty). Versions are resolved against this registry.
  repository?: string;
  // Display name shown in the console menu; the service `name` (its identity
  // and route) is used when empty.
  label?: string;
  // false for infrastructure-only packages (operators, storage backends) with
  // no console page; undefined when the catalog does not set it, which the
  // console treats as exposing a UI. Drives whether the service appears in the
  // catalog-driven project menu.
  exposesUI?: boolean;
}

/**
 * A console navigation section, from the Context (spec.context.okdp.categories,
 * served by GET /api/platform-categories). It gives a service's `category` key
 * a display label, an optional section icon and an order, so the project menu
 * is grouped and ordered from the catalog rather than hardcoded in the UI.
 */
export interface MenuCategory {
  key: string;
  label: string;
  icon?: string;
  /** Optional on the wire; categories without it sort as 0. */
  order?: number;
}

/**
 * Write payload for the catalog-management endpoints (POST/PUT
 * /api/platform-services). `defaultVersion` is optional on the wire — the
 * server falls back to the first version when it is omitted. The server also
 * validates each version against the OCI registry (quay.io) and rejects the
 * request (400) when a version does not exist. `repository` overrides the
 * package registry for this service; omitted means the global one is used.
 */
export interface PlatformServiceRequest {
  name: string;
  versions: string[];
  defaultVersion?: string;
  description?: string;
  icon?: string;
  category?: string;
  repository?: string;
  label?: string;
  exposesUI?: boolean;
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
  /** State in the vocabulary every engine shares (Pending, Installing,
   *  Updating, Ready, Degraded, Error, Suspended, Deleting, Unknown). Absent
   *  from older servers, which send `status` alone. Read through
   *  instancePhase, never directly. */
  phase?: string;
  /**
   * Human-readable explanation set by the backend when status is not
   * "Ready". Typically the latest K8s Warning event in the namespace
   * (e.g. a Helm upgrade failure or an invalid resource parameter).
   */
  statusMessage?: string;
  targetNamespace: string;
  url?: string;
  parameters: Record<string, unknown>;
  /** What the release is actually wired to, published by the controller,
   *  as opposed to what the service asked for. */
  connections?: ServiceConnection[];
  createdAt?: string;
  /** Opaque version of the desired state, sent back as `If-Match` on an
   *  update or a deletion. Never displayed. Absent or empty when the engine
   *  reports none. */
  desiredRevision?: string;
}

/** Problem attached to a rejected write. */
export interface WriteProblem {
  code?: string;
  field?: string;
  message?: string;
}

/** How the engine answered a write. `unknown` means it gave no definite
 *  answer (timeout, push without reply): the state must be read again.
 *  Accepted writes include it in a 2xx response, rejected writes in a 409 or
 *  500 error body, and unknown outcomes in a 504 error body. */
export interface WriteOperation {
  outcome?: 'accepted' | 'rejected' | 'unknown' | (string & {});
  desiredRevision?: string;
  problems?: WriteProblem[];
  message?: string;
}

/** Response envelope carrying an engine write operation. */
export interface OperationResponse {
  operation?: WriteOperation;
}

/** Response of an instance write. Servers without pluggable engines send the
 *  instance alone. */
export interface ServiceWriteResult extends ServiceInstance, OperationResponse {}

/** Answer to an instance deletion: its HTTP status and, when the server
 *  sends one as JSON, the engine's answer. */
export interface ServiceDeleteAnswer {
  status: number;
  result?: OperationResponse;
}

/** One connection a deployed service is bound to. */
export interface ServiceConnection {
  name: string;
  namespace?: string;
  /** Connection or ClusterConnection: the two may share a name. */
  kind: string;
  /** False while the release is still waiting for it. */
  resolved: boolean;
  /** How far the connection got: declared, published, bound or ready.
   *  Absent from older servers and when the engine cannot tell. */
  state?: string;
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
