import { describe, expect, it } from 'vitest';
import { flattenReviewParams, formatReviewValue } from './format-review-value';

describe('formatReviewValue', () => {
  it('renders scalars as their string form', () => {
    expect(formatReviewValue('airflow')).toBe('airflow');
    expect(formatReviewValue(1)).toBe('1');
    expect(formatReviewValue(true)).toBe('true');
  });

  // Display only: the deployed value keeps its type. The review still shows the
  // type, so a boolean and a look-alike string do not read the same.
  it('keeps the scalar type visible', () => {
    expect(formatReviewValue(true)).toBe('true');
    expect(formatReviewValue('true')).toBe('"true"');
    expect(formatReviewValue(60)).toBe('60');
    expect(formatReviewValue('60')).toBe('"60"');
    expect(formatReviewValue('60s')).toBe('60s');
  });

  it.each([[null], [undefined], ['']])('renders an empty value (%s) as an em dash', (v) => {
    expect(formatReviewValue(v)).toBe('—');
  });

  it('renders an empty object or array as an em dash, not "{}" / "[]"', () => {
    expect(formatReviewValue({})).toBe('—');
    expect(formatReviewValue([])).toBe('—');
  });

  it('flattens an object into "key: value" pairs instead of raw JSON', () => {
    expect(
      formatReviewValue({
        enabled: true,
        repo: 'https://github.com/okdp/okdp-examples.git',
        branch: 'main',
        period: '60s',
      }),
    ).toBe(
      'enabled: true, repo: https://github.com/okdp/okdp-examples.git, branch: main, period: 60s',
    );
  });

  it('joins array items with commas', () => {
    expect(formatReviewValue(['Admin', 'Viewer'])).toBe('Admin, Viewer');
  });

  it('recurses into nested objects', () => {
    expect(formatReviewValue({ credentialsSecret: { name: 'git-creds' } })).toBe(
      'credentialsSecret: name: git-creds',
    );
  });
});

describe('flattenReviewParams', () => {
  it('flattens a nested object into one dotted-key row per leaf', () => {
    expect(
      flattenReviewParams({
        dagsGitSync: {
          enabled: true,
          repo: 'https://github.com/okdp/okdp-examples.git',
          branch: 'main',
          period: '60s',
        },
      }),
    ).toEqual([
      { key: 'dagsGitSync.enabled', value: 'true' },
      { key: 'dagsGitSync.repo', value: 'https://github.com/okdp/okdp-examples.git' },
      { key: 'dagsGitSync.branch', value: 'main' },
      { key: 'dagsGitSync.period', value: '60s' },
    ]);
  });

  it('keeps scalars, arrays and empty objects as a single row', () => {
    expect(flattenReviewParams({ name: 'airflow', schedulerMemoryGi: 1 })).toEqual([
      { key: 'name', value: 'airflow' },
      { key: 'schedulerMemoryGi', value: '1' },
    ]);
    expect(flattenReviewParams({ roles: ['Admin', 'Viewer'] })).toEqual([
      { key: 'roles', value: 'Admin, Viewer' },
    ]);
    expect(flattenReviewParams({ oidcRoleMapping: {} })).toEqual([
      { key: 'oidcRoleMapping', value: '—' },
    ]);
  });

  it('flattens deeply nested objects', () => {
    expect(flattenReviewParams({ dagsGitSync: { credentialsSecret: { name: 'git-creds' } } })).toEqual([
      { key: 'dagsGitSync.credentialsSecret.name', value: 'git-creds' },
    ]);
  });
});
