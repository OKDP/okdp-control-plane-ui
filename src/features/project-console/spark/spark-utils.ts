/* eslint-disable @typescript-eslint/no-explicit-any */

export type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | undefined;

export function getStatusSeverity(status: string): TagSeverity {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'RUNNING':
      return 'info';
    case 'SUBMITTED':
    case 'PENDING_RERUN':
      return 'warning';
    case 'FAILED':
    case 'FAILING':
      return 'danger';
    default:
      return 'secondary';
  }
}

export function getExecutorSeverity(state: string): TagSeverity {
  switch (state) {
    case 'COMPLETED':
      return 'success';
    case 'RUNNING':
      return 'info';
    case 'PENDING':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'secondary';
  }
}

export function isTerminalStatus(status: string): boolean {
  return ['COMPLETED', 'FAILED', 'FAILING'].includes(status);
}

export function parseKeyValue(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key?.trim() && rest.length > 0) {
      result[key.trim()] = rest.join('=').trim();
    }
  }
  return result;
}

export function toOptions(values: string[]): { label: string; value: string }[] {
  return values.map((v) => ({ label: v, value: v }));
}

export interface SchemaProperty {
  key: string;
  type: string;
  description: string;
  enumValues?: string[];
  isObject: boolean;
  isArray: boolean;
  itemType?: string;
}

export interface SchemaSection {
  title: string;
  icon: string;
  iconClass: string;
  properties: SchemaProperty[];
}

export function toSchemaProperty(key: string, spec: any): SchemaProperty {
  const type = spec.type || 'string';
  const isObject = type === 'object';
  const isArray = type === 'array';
  return {
    key,
    type,
    description: spec.description || '',
    enumValues: spec.enum,
    isObject,
    isArray,
    itemType: isArray ? spec.items?.type : undefined,
  };
}

export const CORE_KEYS_SUBMIT = [
  'type',
  'mode',
  'image',
  'mainClass',
  'mainApplicationFile',
  'arguments',
  'sparkVersion',
];
export const CORE_KEYS_EDIT = [
  'mode',
  'image',
  'mainClass',
  'mainApplicationFile',
  'arguments',
  'sparkVersion',
];
export const RESOURCE_KEYS = ['driver', 'executor', 'dynamicAllocation', 'memoryOverheadFactor'];
export const CONFIG_KEYS = [
  'sparkConf',
  'hadoopConf',
  'sparkConfigMap',
  'hadoopConfigMap',
  'deps',
  'volumes',
];

/**
 * Group CRD schema properties into Core / Resources / Configuration /
 * Advanced sections. `extraKnownKeys` lists keys deliberately excluded from
 * the Advanced bucket (e.g. 'type' on the edit page where it is read-only).
 */
export function buildSections(
  schema: Record<string, any>,
  coreKeys: string[],
  extraKnownKeys: string[] = [],
): SchemaSection[] {
  const toProps = (keys: string[]): SchemaProperty[] =>
    keys.filter((k) => schema[k]).map((k) => toSchemaProperty(k, schema[k]));

  const knownKeys = new Set([...coreKeys, ...RESOURCE_KEYS, ...CONFIG_KEYS, ...extraKnownKeys]);
  const advancedKeys = Object.keys(schema)
    .filter((k) => !knownKeys.has(k))
    .sort();

  const sections: SchemaSection[] = [
    { title: 'Core', icon: 'pi-cog', iconClass: 'core', properties: toProps(coreKeys) },
    {
      title: 'Resources',
      icon: 'pi-server',
      iconClass: 'resources',
      properties: toProps(RESOURCE_KEYS),
    },
    {
      title: 'Configuration',
      icon: 'pi-sliders-h',
      iconClass: 'config',
      properties: toProps(CONFIG_KEYS),
    },
  ];

  if (advancedKeys.length > 0) {
    sections.push({
      title: 'Advanced',
      icon: 'pi-wrench',
      iconClass: 'advanced',
      properties: toProps(advancedKeys),
    });
  }

  return sections.filter((s) => s.properties.length > 0);
}
