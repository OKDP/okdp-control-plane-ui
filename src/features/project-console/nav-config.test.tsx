import { describe, it, expect } from 'vitest';
import { catalogNavItems } from './nav-config';

describe('catalogNavItems', () => {
  it('excludes services that already have a bespoke console area', () => {
    const items = catalogNavItems([
      { name: 'trinodb' },
      { name: 'jupyterhub' },
      { name: 'spark-history-server' },
    ]);
    expect(items).toHaveLength(0);
  });

  it('maps an unknown catalog service to a generic /services/<name> entry', () => {
    const [item] = catalogNavItems([{ name: 'custom-store' }]);
    expect(item.segment).toBe('services/custom-store');
    expect(item.label).toBe('custom-store');
    expect(item.icon).toBe('pi pi-box');
    // No known brand → falls back to the icon (a generic box here).
    expect(item.brand).toBeUndefined();
  });

  it('normalizes the icon (bare `pi-x`, full `pi pi-x`, or missing)', () => {
    const [bare, full, none] = catalogNavItems([
      { name: 'a', icon: 'pi-database' },
      { name: 'b', icon: 'pi pi-server' },
      { name: 'c' },
    ]);
    expect(bare.icon).toBe('pi pi-database');
    expect(full.icon).toBe('pi pi-server');
    expect(none.icon).toBe('pi pi-box');
  });

  it('attaches a real brand logo to known catalog services', () => {
    const [seaweedfs, sparkOperator] = catalogNavItems([
      { name: 'seaweedfs' },
      { name: 'spark-operator' },
    ]);
    expect(seaweedfs.brand).toBeDefined();
    expect(sparkOperator.brand).toBeDefined();
  });

  it('keeps only the non-bespoke services from a mixed catalog', () => {
    const items = catalogNavItems([
      { name: 'trinodb' },
      { name: 'seaweedfs' },
      { name: 'superset' },
      { name: 'spark-operator' },
    ]);
    expect(items.map((i) => i.label)).toEqual(['seaweedfs', 'spark-operator']);
    expect(items.map((i) => i.segment)).toEqual([
      'services/seaweedfs',
      'services/spark-operator',
    ]);
  });
});
