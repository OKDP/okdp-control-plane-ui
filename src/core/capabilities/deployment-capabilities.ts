import type { Capabilities } from '../api/capabilities-api';

export interface EngineCapability {
  /** Display only. Screens test capabilities, never this name. */
  name?: string;
  /** The engine can return the values it rendered for an instance. */
  renderedValues: boolean;
  /** The engine can suspend an instance. */
  suspend: boolean;
}

/** What a server without engine capabilities supports. */
export const DEFAULT_ENGINE_CAPABILITY: EngineCapability = Object.freeze({
  renderedValues: false,
  suspend: false,
});

function flag(value: unknown): boolean {
  return value === true;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Resolves the engine capabilities, field by field, from whatever the server
 *  sent. Missing, mistyped or unknown values fall back to
 *  DEFAULT_ENGINE_CAPABILITY. */
export function resolveEngineCapability(
  caps: Capabilities | null | undefined,
): EngineCapability {
  const engine = caps?.engine;
  if (!engine || typeof engine !== 'object') return DEFAULT_ENGINE_CAPABILITY;
  const name = nonEmptyString(engine.name);
  return {
    ...(name ? { name } : {}),
    renderedValues: flag(engine.renderedValues),
    suspend: flag(engine.suspend),
  };
}
