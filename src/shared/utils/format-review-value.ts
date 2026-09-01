import { scalarValueToText } from './scalar-value';

/**
 * Render a deploy-review parameter value as human-readable text. This is a
 * display helper only: the value actually deployed is the typed one held in the
 * form state, never this string.
 *
 * Object- and array-typed parameters (a git-sync config, a role mapping) were
 * shown as raw `JSON.stringify` output on the Review step, e.g.
 * `{"enabled":"true","repo":"...","period":"60s"}`, a wall of punctuation next
 * to the plain scalar rows. They are flattened to `key: value` pairs instead,
 * and an empty object or array reads as an em dash rather than `{}` / `[]`.
 *
 * A scalar is rendered through `scalarValueToText`, so its type stays visible:
 * a boolean shows as `true`, a number as `60`, and a string that would read as
 * either is quoted (`"true"`). The review then matches how the value was typed.
 */
export function formatReviewValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) {
    return value.length ? value.map(formatReviewValue).join(', ') : '—';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length
      ? entries.map(([k, v]) => `${k}: ${formatReviewValue(v)}`).join(', ')
      : '—';
  }
  return scalarValueToText(value);
}

/**
 * Flatten deploy parameters into review rows. A nested object becomes one
 * dotted-key row per leaf (`dagsGitSync.repo`, `dagsGitSync.period`, ...), so
 * each value gets its own short aligned row instead of a single long
 * `key: value, key: value` line crammed into the value cell. Scalars, arrays,
 * and empty objects stay a single row.
 */
export function flattenReviewParams(
  params: Record<string, unknown>,
): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [];
  const walk = (prefix: string, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0) {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        walk(prefix ? `${prefix}.${k}` : k, val);
      }
    } else {
      rows.push({ key: prefix, value: formatReviewValue(v) });
    }
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return rows;
}
