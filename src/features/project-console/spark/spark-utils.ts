/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StatusTone } from '../../../shared/components/status-tag';
import type { SparkAppUpdateRequest } from '../../../core/models/spark.model';

export function getStatusTone(status: string): StatusTone {
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
      return 'neutral';
  }
}

export function getExecutorTone(state: string): StatusTone {
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
      return 'neutral';
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

/**
 * Tailwind tone classes for the section icon badges, keyed by
 * {@link SchemaSection.iconClass}: badge background + icon colour.
 */
export const SECTION_BADGE_TONES: Record<string, { badge: string; icon: string }> = {
  core: { badge: 'bg-accent-amber-light', icon: 'text-[1rem] text-warning' },
  resources: { badge: 'bg-accent-purple-light', icon: 'text-[1rem] text-accent-purple' },
  config: { badge: 'bg-accent-blue-light', icon: 'text-[1rem] text-accent-blue' },
};

function toSchemaProperty(key: string, spec: any): SchemaProperty {
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
export const CORE_KEYS_EDIT = ['image', 'mainClass', 'mainApplicationFile', 'arguments'];
// Only the keys SparkAppRequest/SparkAppUpdateRequest can carry are rendered —
// anything else would be silently dropped on submit/save.
export const RESOURCE_KEYS = ['driver', 'executor'];
export const CONFIG_KEYS = ['sparkConf'];

/**
 * Group CRD schema properties into Core / Resources / Configuration sections,
 * restricted to the keys the submit/update request models actually map.
 */
export function buildSections(schema: Record<string, any>, coreKeys: string[]): SchemaSection[] {
  const toProps = (keys: string[]): SchemaProperty[] =>
    keys.filter((k) => schema[k]).map((k) => toSchemaProperty(k, schema[k]));

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

  return sections.filter((s) => s.properties.length > 0);
}

/**
 * Sections rendered when the CRD schema cannot be fetched. The edit page
 * filters the read-only 'type'/'mode' keys out of Core.
 */
export const FALLBACK_SECTIONS: SchemaSection[] = [
  {
    title: 'Core',
    icon: 'pi-cog',
    iconClass: 'core',
    properties: [
      {
        key: 'type',
        type: 'string',
        description: 'Application language type',
        enumValues: ['Java', 'Scala', 'Python', 'R'],
        isObject: false,
        isArray: false,
      },
      {
        key: 'mode',
        type: 'string',
        description: 'Deploy mode',
        enumValues: ['cluster', 'client'],
        isObject: false,
        isArray: false,
      },
      { key: 'image', type: 'string', description: 'Spark image', isObject: false, isArray: false },
      {
        key: 'mainClass',
        type: 'string',
        description: 'Main class',
        isObject: false,
        isArray: false,
      },
      {
        key: 'mainApplicationFile',
        type: 'string',
        description: 'Main application file',
        isObject: false,
        isArray: false,
      },
      {
        key: 'arguments',
        type: 'array',
        description: 'Application arguments',
        isObject: false,
        isArray: true,
        itemType: 'string',
      },
    ],
  },
  {
    title: 'Resources',
    icon: 'pi-server',
    iconClass: 'resources',
    properties: [
      {
        key: 'driver',
        type: 'object',
        description: 'Driver pod resources',
        isObject: true,
        isArray: false,
      },
      {
        key: 'executor',
        type: 'object',
        description: 'Executor pod resources',
        isObject: true,
        isArray: false,
      },
    ],
  },
  {
    title: 'Configuration',
    icon: 'pi-sliders-h',
    iconClass: 'config',
    properties: [
      {
        key: 'sparkConf',
        type: 'object',
        description: 'Spark configuration (key=value)',
        isObject: true,
        isArray: false,
      },
    ],
  },
];

type SparkResourceFields = Pick<
  SparkAppUpdateRequest,
  | 'arguments'
  | 'driverCores'
  | 'driverMemory'
  | 'executorInstances'
  | 'executorCores'
  | 'executorMemory'
  | 'sparkConf'
>;

export interface SparkNumericDefaults {
  driverCores?: number;
  executorInstances?: number;
  executorCores?: number;
}

/**
 * Map the free-form arguments/driver/executor/sparkConf form values onto a
 * submit or update request. Without `numericDefaults` (edit page) unparseable
 * integers stay undefined and are omitted from the PATCH; the submit page
 * passes its platform defaults instead.
 */
export function applyResourceFormValues(
  req: SparkResourceFields,
  formValues: Record<string, any>,
  numericDefaults: SparkNumericDefaults = {},
): void {
  const argsStr = formValues['arguments'];
  if (argsStr && typeof argsStr === 'string') {
    req.arguments = argsStr
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  const driverStr = formValues['driver'];
  if (driverStr && typeof driverStr === 'string') {
    const parsed = parseKeyValue(driverStr);
    if (parsed['cores']) {
      req.driverCores = parseInt(parsed['cores'], 10) || numericDefaults.driverCores;
    }
    if (parsed['memory']) req.driverMemory = parsed['memory'];
  }

  const executorStr = formValues['executor'];
  if (executorStr && typeof executorStr === 'string') {
    const parsed = parseKeyValue(executorStr);
    if (parsed['instances']) {
      req.executorInstances =
        parseInt(parsed['instances'], 10) || numericDefaults.executorInstances;
    }
    if (parsed['cores']) {
      req.executorCores = parseInt(parsed['cores'], 10) || numericDefaults.executorCores;
    }
    if (parsed['memory']) req.executorMemory = parsed['memory'];
  }

  const sparkConfStr = formValues['sparkConf'];
  if (sparkConfStr && typeof sparkConfStr === 'string' && sparkConfStr.trim()) {
    req.sparkConf = parseKeyValue(sparkConfStr);
  }
}
