import { environment } from '../../config/environment';
import { http } from './http';
import type { PlatformService, PlatformServiceRequest } from '../models/service.model';

const apiUrl = `${environment.apiBaseUrl}/api/platform-services`;
const seg = encodeURIComponent;

// CRUD for the platform-service catalog (the services exposed to projects).
// The list endpoint is the same one the deploy pages read through
// `serviceApi.getPlatformServices()`; this module keeps the admin catalog
// screen self-contained (mirrors identity-api). The refresh/polling state
// lives in the admin feature's useCatalog hook.
export const catalogApi = {
  listServices(): Promise<PlatformService[]> {
    return http.getList<PlatformService>(apiUrl);
  },

  createService(service: PlatformServiceRequest): Promise<PlatformService> {
    return http.post<PlatformService>(apiUrl, service);
  },

  updateService(name: string, service: PlatformServiceRequest): Promise<PlatformService> {
    return http.put<PlatformService>(`${apiUrl}/${seg(name)}`, service);
  },

  deleteService(name: string): Promise<void> {
    return http.delete(`${apiUrl}/${seg(name)}`);
  },
};
