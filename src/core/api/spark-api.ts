import { environment } from '../../config/environment';
import { http } from './http';
import { subscribeJsonStream, subscribeTextStream, type StreamSubscriber } from './sse';
import type {
  SparkAppRequest,
  SparkAppYAMLRequest,
  SparkAppInstance,
  SparkAppUpdateRequest,
  SparkAppEvent,
  SparkConfig,
  SparkUIInfo,
} from '../models/spark.model';

const baseUrl = environment.apiBaseUrl;

export const sparkApi = {
  getSparkConfig(): Promise<SparkConfig> {
    return http.get<SparkConfig>(`${baseUrl}/api/spark-config`);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAppSchema(): Promise<Record<string, any>> {
    return http.get(`${baseUrl}/api/spark-app-schema`);
  },

  submitApp(projectId: string, req: SparkAppRequest): Promise<SparkAppInstance> {
    return http.post<SparkAppInstance>(`${baseUrl}/api/projects/${projectId}/spark-apps`, req);
  },

  submitAppYAML(projectId: string, req: SparkAppYAMLRequest): Promise<SparkAppInstance> {
    return http.post<SparkAppInstance>(`${baseUrl}/api/projects/${projectId}/spark-apps/yaml`, req);
  },

  async listApps(projectId: string): Promise<SparkAppInstance[]> {
    return (
      (await http.get<SparkAppInstance[]>(`${baseUrl}/api/projects/${projectId}/spark-apps`)) || []
    );
  },

  getApp(projectId: string, appName: string): Promise<SparkAppInstance> {
    return http.get<SparkAppInstance>(`${baseUrl}/api/projects/${projectId}/spark-apps/${appName}`);
  },

  updateApp(
    projectId: string,
    appName: string,
    req: SparkAppUpdateRequest,
  ): Promise<SparkAppInstance> {
    return http.put<SparkAppInstance>(
      `${baseUrl}/api/projects/${projectId}/spark-apps/${appName}`,
      req,
    );
  },

  getSparkUI(projectId: string, appName: string): Promise<SparkUIInfo> {
    return http.get<SparkUIInfo>(`${baseUrl}/api/projects/${projectId}/spark-apps/${appName}/ui`);
  },

  deleteApp(projectId: string, appName: string): Promise<void> {
    return http.delete(`${baseUrl}/api/projects/${projectId}/spark-apps/${appName}`);
  },

  subscribeApps(projectId: string, subscriber: StreamSubscriber<SparkAppEvent>): () => void {
    return subscribeJsonStream(
      `${baseUrl}/api/projects/${projectId}/spark-apps/stream`,
      subscriber,
      'Spark SSE',
    );
  },

  getDriverLogs(
    projectId: string,
    appName: string,
    tailLines = 100,
    container?: string,
  ): Promise<string> {
    let url = `${baseUrl}/api/projects/${projectId}/spark-apps/${appName}/logs?tailLines=${tailLines}`;
    if (container) {
      url += `&container=${encodeURIComponent(container)}`;
    }
    return http.getText(url);
  },

  streamDriverLogs(
    projectId: string,
    appName: string,
    subscriber: StreamSubscriber<string>,
    tailLines = 100,
  ): () => void {
    const url = `${baseUrl}/api/projects/${projectId}/spark-apps/${appName}/logs?follow=true&tailLines=${tailLines}`;
    return subscribeTextStream(url, subscriber);
  },
};
