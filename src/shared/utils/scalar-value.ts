/**
 * Value typing for a free-form parameter map, inferred from what is typed
 * rather than from a fixed set of options:
 *
 *   - quoted (`"true"`, `"60"`)  -> string (the quotes force it)
 *   - `true` / `false`           -> boolean
 *   - an integer or a float      -> number
 *   - anything else              -> string
 *
 * This keeps a boolean a boolean and a number a number on the way to the chart,
 * without freezing the keys or their types.
 */
export function parseScalarValue(text: string): unknown {
  const t = text.trim();
  if (t === '') return '';
  if (t.length >= 2) {
    const first = t[0];
    const last = t[t.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return t.slice(1, -1);
    }
  }
  if (t === 'true' || t === 'True' || t === 'TRUE') return true;
  if (t === 'false' || t === 'False' || t === 'FALSE') return false;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?(?:\d+\.\d*|\.\d+|\d+[eE][-+]?\d+|\d+\.\d+[eE][-+]?\d+)$/.test(t) && !Number.isNaN(Number(t))) {
    return Number(t);
  }
  return t;
}

/**
 * Render a stored value back into the editable text. A string that would parse
 * back as a boolean or a number is quoted, so it round-trips as a string
 * instead of silently changing type.
 */
export function scalarValueToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return parseScalarValue(value) === value ? value : JSON.stringify(value);
  }
  return String(value);
}
