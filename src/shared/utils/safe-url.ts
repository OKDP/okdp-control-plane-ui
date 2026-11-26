/** Returns the trimmed `url` when it is an absolute http(s) URL with an
 *  explicit authority, no control characters, and no embedded credentials,
 *  else undefined: a `javascript:`, `data:`, scheme-relative, or spoofed URL
 *  must never be opened or linked. */
export function safeExternalUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(url)) return undefined;
  const trimmed = url.trim();
  if (!/^https?:\/\/[^/\\]/i.test(trimmed)) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (parsed.username || parsed.password) return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}
