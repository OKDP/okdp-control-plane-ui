import { describe, expect, it } from 'vitest';
import { parseScalarValue, scalarValueToText } from './scalar-value';

describe('parseScalarValue', () => {
  it.each([
    ['true', true],
    ['True', true],
    ['false', false],
    ['False', false],
    ['42', 42],
    ['-7', -7],
    ['1.5', 1.5],
    ['1e3', 1000],
    ['main', 'main'],
    ['60s', '60s'],
    ['3.2.1-p04', '3.2.1-p04'],
    ['', ''],
  ])('parses %s by its syntax', (text, expected) => {
    expect(parseScalarValue(text)).toEqual(expected);
  });

  it('treats a quoted value as a string, forcing the type', () => {
    expect(parseScalarValue('"true"')).toBe('true');
    expect(parseScalarValue('"42"')).toBe('42');
    expect(parseScalarValue("'false'")).toBe('false');
  });
});

describe('scalarValueToText', () => {
  it('round-trips scalars back to editable text', () => {
    expect(scalarValueToText(true)).toBe('true');
    expect(scalarValueToText(42)).toBe('42');
    expect(scalarValueToText(1.5)).toBe('1.5');
    expect(scalarValueToText('main')).toBe('main');
    expect(scalarValueToText('60s')).toBe('60s');
  });

  it('quotes a string that would otherwise parse as a boolean or number', () => {
    expect(scalarValueToText('true')).toBe('"true"');
    expect(scalarValueToText('42')).toBe('"42"');
  });
});
