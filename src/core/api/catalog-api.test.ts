import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./http', () => ({
  http: {
    getList: vi.fn(() => Promise.resolve([])),
    post: vi.fn(() => Promise.resolve({})),
    put: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve()),
  },
}));

import { catalogApi } from './catalog-api';
import { http } from './http';

// Dev environment base URL (import.meta.env.PROD is false under Vitest).
const BASE = 'http://localhost:8093/api/platform-services';

describe('catalogApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listServices GETs the platform-services collection', () => {
    catalogApi.listServices();
    expect(http.getList).toHaveBeenCalledWith(BASE);
  });

  it('createService POSTs the request payload to the collection', () => {
    const req = { name: 'jupyterhub', versions: ['1.0.0'], defaultVersion: '1.0.0' };
    catalogApi.createService(req);
    expect(http.post).toHaveBeenCalledWith(BASE, req);
  });

  it('updateService PUTs to the (encoded) name path', () => {
    const req = { name: 'spark history', versions: ['1.0.0'] };
    catalogApi.updateService('spark history', req);
    expect(http.put).toHaveBeenCalledWith(`${BASE}/spark%20history`, req);
  });

  it('deleteService DELETEs the (encoded) name path', () => {
    catalogApi.deleteService('a/b');
    expect(http.delete).toHaveBeenCalledWith(`${BASE}/a%2Fb`);
  });
});
