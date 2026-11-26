import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  areaBasePath,
  connectionStateTag,
  DEPLOY_STAGES,
  instancePhase,
  isInProgress,
  needsAttention,
  isTransitioning,
  openInNewTab,
  parentLabel,
  safeExternalUrl,
  safeReturnTo,
  SERVICE_AREAS,
  statusTone,
} from './service-utils';

describe('areaBasePath', () => {
  it('returns the bespoke area for a known service', () => {
    expect(areaBasePath('trino')).toEqual(['trino']);
    expect(areaBasePath('spark-history-server')).toEqual(['spark', 'history-server']);
  });

  it('routes an unknown catalog service to the generic /services/<name> area (not jupyterhub)', () => {
    expect(areaBasePath('seaweedfs')).toEqual(['services', 'seaweedfs']);
    expect(areaBasePath('spark-operator')).toEqual(['services', 'spark-operator']);
  });

  it('falls back to the generic services list when no service is given', () => {
    expect(areaBasePath('')).toEqual(['services']);
    expect(areaBasePath(undefined)).toEqual(['services']);
    expect(areaBasePath(null)).toEqual(['services']);
  });

  it('never nests an unknown service under a bespoke area', () => {
    // Regression guard for the old `?? ['jupyterhub']` fallback.
    expect(areaBasePath('whatever-new')[0]).toBe('services');
  });
});

describe('parentLabel', () => {
  it('uses the bespoke label, else the service name, else Services', () => {
    expect(parentLabel('trino')).toBe(SERVICE_AREAS['trino'].label);
    expect(parentLabel('seaweedfs')).toBe('seaweedfs');
    expect(parentLabel(undefined)).toBe('Services');
  });
});

describe('DEPLOY_STAGES', () => {
  it('ends at the engine accepting the write', () => {
    expect(DEPLOY_STAGES.map((s) => s.label)).toEqual([
      'Validating parameters',
      'Submitting to the deployment engine',
    ]);
  });
});

describe('instance phases', () => {
  it('keeps the tones of the statuses the current server sends', () => {
    expect(statusTone('Ready')).toBe('success');
    expect(statusTone('Installing')).toBe('warning');
    expect(statusTone('Updating')).toBe('warning');
    expect(statusTone('Error')).toBe('danger');
  });

  it('tells Pending and Unknown apart', () => {
    expect(statusTone('Pending')).toBe('info');
    expect(statusTone('Unknown')).toBe('neutral');
    expect(isTransitioning('Pending')).toBe(true);
    expect(isTransitioning('Unknown')).toBe(false);
  });

  it('covers the other common phases', () => {
    expect(statusTone('Degraded')).toBe('warning');
    expect(statusTone('Suspended')).toBe('neutral');
    expect(statusTone('Deleting')).toBe('warning');
    expect(isInProgress('Deleting')).toBe(true);
    expect(isInProgress('Suspended')).toBe(false);
    expect(isInProgress('Degraded')).toBe(false);
    expect(isInProgress('Ready')).toBe(false);
  });
});

describe('instancePhase', () => {
  it('reads the phase when the server sends one of the nine', () => {
    expect(instancePhase({ status: 'Installing', phase: 'Pending' })).toBe('Pending');
    expect(instancePhase({ status: 'Error', phase: 'Degraded' })).toBe('Degraded');
    expect(instancePhase({ status: 'Installing', phase: 'Unknown' })).toBe('Unknown');
  });

  it('falls back to the status without a usable phase', () => {
    expect(instancePhase({ status: 'Installing' })).toBe('Installing');
    expect(instancePhase({ status: 'Ready', phase: '' })).toBe('Ready');
    expect(instancePhase({ status: 'Updating', phase: 'Nonsense' })).toBe('Updating');
  });

  it('counts Degraded with Error under attention', () => {
    expect(needsAttention('Error')).toBe(true);
    expect(needsAttention('Degraded')).toBe(true);
    expect(needsAttention('Unknown')).toBe(false);
  });
});

describe('connectionStateTag', () => {
  it('shows the state when the server sends one of the four', () => {
    expect(connectionStateTag({ resolved: true, state: 'ready' })).toEqual({
      label: 'Ready',
      tone: 'success',
    });
    expect(connectionStateTag({ resolved: true, state: 'bound' }).label).toBe('Bound');
    expect(connectionStateTag({ resolved: false, state: 'published' }).label).toBe('Published');
    expect(connectionStateTag({ resolved: false, state: 'declared' }).label).toBe('Declared');
  });

  it('falls back to resolved without a usable state', () => {
    expect(connectionStateTag({ resolved: true })).toEqual({ label: 'Resolved', tone: 'success' });
    expect(connectionStateTag({ resolved: false })).toEqual({ label: 'Waiting', tone: 'warning' });
    expect(connectionStateTag({ resolved: true, state: '' }).label).toBe('Resolved');
    expect(connectionStateTag({ resolved: false, state: 'Ready' }).label).toBe('Waiting');
    expect(connectionStateTag({ resolved: true, state: 'constructor' }).label).toBe('Resolved');
    expect(connectionStateTag({ resolved: false, state: 'toString' }).label).toBe('Waiting');
  });
});

describe('safeExternalUrl', () => {
  it('keeps an absolute http(s) URL', () => {
    expect(safeExternalUrl('https://lake.example/ui')).toBe('https://lake.example/ui');
    expect(safeExternalUrl('http://10.0.0.1:8080')).toBe('http://10.0.0.1:8080');
  });

  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'file:///etc/passwd',
    '/relative/path',
    'not a url',
    '',
  ])('refuses %s', (url) => {
    expect(safeExternalUrl(url)).toBeUndefined();
  });
});

describe('openInNewTab', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens an http(s) URL without an opener and ignores anything else', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openInNewTab('javascript:alert(1)');
    openInNewTab('data:text/html,x');
    expect(open).not.toHaveBeenCalled();

    openInNewTab('https://lake.example');
    expect(open).toHaveBeenCalledWith('https://lake.example', '_blank', 'noopener,noreferrer');
  });
});

describe('safeReturnTo', () => {
  it('keeps a path inside the console', () => {
    expect(safeReturnTo('/projects/team-a/trino?x=1')).toBe('/projects/team-a/trino?x=1');
  });

  it.each([
    ['protocol-relative', '//evil.example/x'],
    ['backslash', '/\\evil.example'],
    ['absolute', 'https://evil.example'],
    ['script', 'javascript:alert(1)'],
    ['relative', 'projects/team-a'],
    ['empty', ''],
    ['tab', '/\t/evil.example/x'],
    ['line break', '/\n/evil.example/x'],
    ['carriage return', '/\r/evil.example'],
    ['space', '/ /evil.example'],
    ['embedded backslash', '/projects\\..\\/evil'],
    ['dot-segment protocol-relative', '/.//evil.com'],
    ['parent-segment protocol-relative', '/..//evil.com'],
    ['nested parent protocol-relative', '/projects/..//evil.com'],
  ])('refuses a %s value', (_label, value) => {
    expect(safeReturnTo(value)).toBeUndefined();
  });

  it('refuses a missing value', () => {
    expect(safeReturnTo(null)).toBeUndefined();
  });
});
