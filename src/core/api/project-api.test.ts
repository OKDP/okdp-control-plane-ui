import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./http', () => ({
  http: {
    get: vi.fn(() => Promise.resolve({ members: [], canManage: false })),
    put: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve()),
  },
}));

import { projectApi } from './project-api';
import { http } from './http';

const MEMBERS = 'http://localhost:8093/api/projects/demo/members';

describe('projectApi members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the member in the body of a PUT', () => {
    const member = { kind: 'group', name: 'data_scientist', role: 'edit' } as const;
    projectApi.setMember('demo', member);
    expect(http.put).toHaveBeenCalledWith(MEMBERS, member);
  });

  // Pins the query parameter names against the server contract. A name can
  // hold characters a path segment would not carry, an email for instance.
  it('names the member to remove in the query', () => {
    projectApi.removeMember('demo', 'user', 'mark@example.org');
    expect(http.delete).toHaveBeenCalledWith(`${MEMBERS}?kind=user&member=mark%40example.org`);
  });
});
