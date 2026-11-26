import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from './safe-url';

describe('safeExternalUrl', () => {
  it('accepts absolute http(s) URLs with an explicit authority and trims outer spaces', () => {
    expect(safeExternalUrl('https://lake.example/ui')).toBe('https://lake.example/ui');
    expect(safeExternalUrl('http://10.0.0.1:8080/path?q=1#frag')).toBe(
      'http://10.0.0.1:8080/path?q=1#frag',
    );
    expect(safeExternalUrl('  https://example.com/dashboard  ')).toBe(
      'https://example.com/dashboard',
    );
    expect(safeExternalUrl('HTTPS://EXAMPLE.COM/app')).toBe('HTTPS://EXAMPLE.COM/app');
  });

  it.each([
    ['missing authority slash', 'https:/admin'],
    ['scheme without authority', 'https:foo'],
    ['triple slash', 'https:///admin'],
    ['backslash authority', 'https://\\evil.example'],
    ['empty host', 'https://'],
    ['embedded tab', 'ht\ttps://example.com'],
    ['CRLF injection', 'https://example.com\r\nfoo'],
    ['null byte', 'https://example.com/\u0000'],
    ['DEL control char', 'https://example.com/\u007f'],
    ['leading newline', '\nhttps://example.com'],
    ['embedded username', 'https://user@evil.example/'],
    ['spoofed username', 'https://okdp-ui@evil.example/'],
    ['embedded credentials', 'https://user:pass@evil.example/'],
    ['embedded password only', 'https://:pass@evil.example/'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript scheme', 'vbscript:msgbox(1)'],
    ['file scheme', 'file:///etc/passwd'],
    ['protocol-relative', '//evil.example/path'],
    ['relative path', '/projects/team-a'],
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('rejects %s (%s)', (_label, value) => {
    expect(safeExternalUrl(value)).toBeUndefined();
  });

  it('rejects null and undefined', () => {
    expect(safeExternalUrl(null)).toBeUndefined();
    expect(safeExternalUrl(undefined)).toBeUndefined();
  });
});
