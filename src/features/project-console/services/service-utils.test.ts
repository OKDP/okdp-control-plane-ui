import { describe, it, expect } from 'vitest';
import { areaBasePath, parentLabel, SERVICE_AREAS } from './service-utils';

describe('areaBasePath', () => {
  it('returns the bespoke area for a known service', () => {
    expect(areaBasePath('trinodb')).toEqual(['trino']);
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
    expect(parentLabel('trinodb')).toBe(SERVICE_AREAS['trinodb'].label);
    expect(parentLabel('seaweedfs')).toBe('seaweedfs');
    expect(parentLabel(undefined)).toBe('Services');
  });
});
