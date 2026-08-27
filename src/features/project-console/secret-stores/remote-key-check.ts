import type { RemoteKeyCheck } from '../../../core/api/external-secret-api';

/**
 * How a checked key reads in the form.
 *
 * `unknown` is a state of its own rather than a flavour of failure: the control
 * plane could not ask, so the key may well be fine. Folding it into either
 * `found` or `absent` would put a verdict on screen that nobody established.
 */
export type CheckTone = 'found' | 'absent' | 'unknown' | 'checking';

export interface CheckDisplay {
  tone: CheckTone;
  message: string;
  /** Property names the key holds, offered as the correction to a typo. */
  properties: string[];
}

export function describeCheck(check: RemoteKeyCheck): CheckDisplay {
  if (!check.verifiable) {
    return { tone: 'unknown', message: check.message, properties: [] };
  }
  return {
    tone: check.found ? 'found' : 'absent',
    message: check.message,
    properties: check.properties ?? [],
  };
}

/** Reads as a request that was refused, not as a key that is missing. */
export function describeCheckFailure(message: string): CheckDisplay {
  return { tone: 'unknown', message, properties: [] };
}
