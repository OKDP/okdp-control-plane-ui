import { describe, it, expect } from 'vitest';
import { catalogConsoleCategories, navPrefKey } from './nav-config';
import type { MenuCategory, PlatformService } from '../../core/models/service.model';

function svc(name: string, extra: Partial<PlatformService> = {}): PlatformService {
  return { name, versions: ['1.0.0'], defaultVersion: '1.0.0', description: '', ...extra };
}

const CATEGORIES: MenuCategory[] = [
  { key: 'data-catalog', label: 'Data Catalog', icon: 'pi-database', order: 1 },
  { key: 'data-processing', label: 'Data Processing', icon: 'pi-bolt', order: 2 },
];

describe('catalogConsoleCategories', () => {
  it('groups services into ordered, labeled sections from the category metadata', () => {
    const sections = catalogConsoleCategories(
      [
        svc('spark-history-server', { category: 'data-processing' }),
        svc('polaris', { category: 'data-catalog' }),
      ],
      CATEGORIES,
    );
    expect(sections.map((s) => s.label)).toEqual(['Data Catalog', 'Data Processing']);
    // Section icon is the bare primeicon (NavSection prepends `pi `).
    expect(sections[0].icon).toBe('pi-database');
    expect(sections[0].items.map((i) => i.label)).toEqual(['Polaris']);
  });

  it('respects the configured order regardless of input order', () => {
    const reversed: MenuCategory[] = [
      { key: 'data-processing', label: 'Data Processing', icon: 'pi-bolt', order: 2 },
      { key: 'data-catalog', label: 'Data Catalog', icon: 'pi-database', order: 1 },
    ];
    const sections = catalogConsoleCategories(
      [
        svc('polaris', { category: 'data-catalog' }),
        svc('spark-history-server', { category: 'data-processing' }),
      ],
      reversed,
    );
    expect(sections.map((s) => s.label)).toEqual(['Data Catalog', 'Data Processing']);
  });

  it('keeps the brand logo and bespoke route for a known service', () => {
    const [section] = catalogConsoleCategories(
      [svc('spark-history-server', { category: 'data-processing' })],
      [{ key: 'data-processing', label: 'Data Processing', icon: 'pi-bolt', order: 1 }],
    );
    const [item] = section.items;
    expect(item.label).toBe('Spark');
    expect(item.segment).toBe('spark/history-server');
    expect(item.brand).toBeDefined();
  });

  it('uses the catalog label over the bespoke label when set', () => {
    const [section] = catalogConsoleCategories(
      [svc('trino', { category: 'data-catalog', label: 'Trino SQL' })],
      CATEGORIES,
    );
    expect(section.items[0].label).toBe('Trino SQL');
    // The bespoke brand is still kept.
    expect(section.items[0].brand).toBeDefined();
  });

  it('routes an unknown service to a generic /services/<name> entry with its catalog icon', () => {
    const [section] = catalogConsoleCategories(
      [svc('my-store', { category: 'data-catalog', icon: 'pi-box' })],
      CATEGORIES,
    );
    const [item] = section.items;
    expect(item.label).toBe('my-store');
    expect(item.segment).toBe('services/my-store');
    expect(item.icon).toBe('pi pi-box');
    expect(item.brand).toBeUndefined();
  });

  it('excludes services that do not expose a UI', () => {
    const sections = catalogConsoleCategories(
      [
        svc('spark-operator', { category: 'data-processing', exposesUI: false }),
        svc('spark-history-server', { category: 'data-processing' }),
      ],
      CATEGORIES,
    );
    expect(sections.flatMap((s) => s.items.map((i) => i.label))).toEqual(['Spark']);
  });

  it('puts uncategorized services and unmapped categories under "Other services"', () => {
    const sections = catalogConsoleCategories(
      [
        svc('polaris', { category: 'data-catalog' }),
        svc('seaweedfs'), // no category
        svc('mystery', { category: 'unmapped' }), // category has no metadata
      ],
      CATEGORIES,
    );
    const other = sections.find((s) => s.label === 'Other services');
    expect(other).toBeDefined();
    expect(other!.items.map((i) => i.label).sort()).toEqual(['mystery', 'seaweedfs']);
  });

  it('returns an empty list when the catalog is empty (console keeps only the fixed section)', () => {
    expect(catalogConsoleCategories([], CATEGORIES)).toEqual([]);
  });

  it('keys the show/hide preference on the stable service name, not the editable label', () => {
    const sections = catalogConsoleCategories(
      [svc('trino', { category: 'data-catalog', label: 'Trino SQL' })],
      CATEGORIES,
    );
    const item = sections[0].items[0];
    expect(item.label).toBe('Trino SQL');
    // An admin rename of the display label must not detach the preference.
    expect(navPrefKey(item)).toBe('trino');
  });

  it('drops hidden items and the sections they empty', () => {
    const sections = catalogConsoleCategories(
      [
        svc('polaris', { category: 'data-catalog' }),
        svc('spark-history-server', { category: 'data-processing' }),
      ],
      CATEGORIES,
      (item) => item.label === 'Polaris',
    );
    expect(sections.map((s) => s.label)).toEqual(['Data Processing']);
  });
});
