/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { sparkApi } from '../../../core/api/spark-api';
import type { SparkAppInstance, SparkAppUpdateRequest } from '../../../core/models/spark.model';
import { apiErrorMessage } from '../services/service-utils';
import {
  buildSections,
  CORE_KEYS_EDIT,
  parseKeyValue,
  SECTION_BADGE_TONES,
  type SchemaSection,
} from './spark-utils';
import { SparkPropertyField } from './spark-property-field';

const FALLBACK_SECTIONS: SchemaSection[] = [
  {
    title: 'Core',
    icon: 'pi-cog',
    iconClass: 'core',
    properties: [
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

export default function SparkEditPage() {
  const navigate = useNavigate();
  const { projectId: projectName, appName = '' } = useParams<{
    projectId: string;
    appName: string;
  }>();
  const toast = useRef<Toast>(null);

  const [app, setApp] = useState<SparkAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemaSections, setSchemaSections] = useState<SchemaSection[]>([]);
  const [imageOptions, setImageOptions] = useState<{ label: string; value: string }[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  const setValue = (key: string, value: any) => setFormValues((v) => ({ ...v, [key]: value }));

  useEffect(() => {
    if (!projectName || !appName) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    Promise.all([
      sparkApi.getApp(projectName, appName),
      sparkApi.getSparkConfig(),
      sparkApi.getAppSchema().catch(() => null),
    ])
      .then(([appData, config, schema]) => {
        if (cancelled) return;
        setApp(appData);

        if (config?.spark?.images) {
          setImageOptions(config.spark.images.map((i) => ({ label: i.label, value: i.image })));
        }

        setFormValues((v) => ({ ...v, image: appData.image, mode: appData.mode }));

        if (schema) {
          // 'type' is read-only on the edit page, keep it out of Advanced.
          setSchemaSections(buildSections(schema, CORE_KEYS_EDIT, ['type']));
        } else {
          setSchemaSections(FALLBACK_SECTIONS);
        }

        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load Spark job',
        });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, appName]);

  const goBack = () => {
    if (projectName && app) {
      navigate(`/project/${projectName}/spark/applications/${app.name}`);
    } else if (projectName) {
      navigate(`/project/${projectName}/spark/applications`);
    }
  };

  const save = () => {
    if (!projectName || !app) return;

    setSaving(true);

    const req: SparkAppUpdateRequest = {};
    if (formValues['image'] && formValues['image'] !== app.image) {
      req.image = formValues['image'];
    }
    if (formValues['mainClass']) req.mainClass = formValues['mainClass'];
    if (formValues['mainApplicationFile']) {
      req.mainApplicationFile = formValues['mainApplicationFile'];
    }

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
      if (parsed['cores']) req.driverCores = parseInt(parsed['cores'], 10) || undefined;
      if (parsed['memory']) req.driverMemory = parsed['memory'];
    }

    const executorStr = formValues['executor'];
    if (executorStr && typeof executorStr === 'string') {
      const parsed = parseKeyValue(executorStr);
      if (parsed['instances'])
        req.executorInstances = parseInt(parsed['instances'], 10) || undefined;
      if (parsed['cores']) req.executorCores = parseInt(parsed['cores'], 10) || undefined;
      if (parsed['memory']) req.executorMemory = parsed['memory'];
    }

    const sparkConfStr = formValues['sparkConf'];
    if (sparkConfStr && typeof sparkConfStr === 'string' && sparkConfStr.trim()) {
      req.sparkConf = parseKeyValue(sparkConfStr);
    }

    sparkApi
      .updateApp(projectName, app.name, req)
      .then(() => {
        toast.current?.show({
          severity: 'success',
          summary: 'Saved',
          detail: `Spark job "${app.name}" has been updated`,
        });
        setSaving(false);
        navigate(`/project/${projectName}/spark/applications/${app.name}`);
      })
      .catch((err) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: apiErrorMessage(err, 'Failed to save changes'),
        });
        setSaving(false);
      });
  };

  return (
    <>
      <Toast ref={toast} />

      <div className="mx-auto max-w-[860px] pt-3">
        <div className="mb-7 animate-in">
          <nav className="mb-5 flex items-center gap-2 text-[13px]">
            <a
              className="flex cursor-pointer items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 font-medium text-fg-secondary no-underline transition-all duration-250 ease-smooth hover:bg-surface-tertiary hover:text-fg"
              onClick={goBack}
              onKeyDown={(e) => e.key === 'Enter' && goBack()}
              tabIndex={0}
            >
              <i className="pi pi-arrow-left text-[11px]"></i>
              Spark Applications
            </a>
            <i className="pi pi-angle-right text-[10px] text-fg-muted"></i>
            <span className="text-[13px] font-medium text-fg-muted">Edit {app?.name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-[0_6px_16px_rgba(245,158,11,0.25)] [background:linear-gradient(135deg,#f59e0b,#d97706)]">
              <i className="pi pi-pencil text-[1.4rem] text-white"></i>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[28px] leading-[1.2] font-extrabold tracking-[-0.03em] text-fg">
                Edit Spark Job
              </h2>
              <p className="mt-1.5 mb-0 text-[15px] text-fg-secondary">
                Modify configuration for {app?.name}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex animate-in flex-col items-center justify-center gap-3 p-16 text-fg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
              <i className="pi pi-spin pi-spinner text-[1.3rem] text-primary"></i>
            </div>
            <p>Loading job configuration...</p>
          </div>
        ) : app ? (
          <div className="animate-[fadeInUp_0.45s_cubic-bezier(0.22,1,0.36,1)_0.08s_backwards]">
            <div className="flex flex-col rounded-xl border border-border-light bg-surface p-7 shadow-[0_4px_12px_rgba(0,0,0,0.03)] max-md:p-5">
              <div className="py-7 first:pt-0 not-last:border-b not-last:border-b-border-light">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                    <i className="pi pi-bookmark text-[1rem] text-primary"></i>
                  </div>
                  <h3 className="m-0 text-[17px] font-bold tracking-[-0.02em] text-fg">
                    Application
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1 text-[13px] font-semibold tracking-[-0.01em] text-fg-secondary">
                      Name
                    </label>
                    <div className="rounded-md border border-border-light bg-surface-secondary px-3 py-2.5 text-[14px] font-medium text-fg">
                      {app.name}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1 text-[13px] font-semibold tracking-[-0.01em] text-fg-secondary">
                      Type
                    </label>
                    <div className="rounded-md border border-border-light bg-surface-secondary px-3 py-2.5 text-[14px] font-medium text-fg">
                      {app.type}
                    </div>
                  </div>
                </div>
              </div>

              {schemaSections.map((section) => (
                <div
                  key={section.title}
                  className="py-7 first:pt-0 not-last:border-b not-last:border-b-border-light"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${SECTION_BADGE_TONES[section.iconClass]?.badge ?? ''}`}
                    >
                      <i
                        className={`pi ${section.icon} ${SECTION_BADGE_TONES[section.iconClass]?.icon ?? 'text-[1rem]'}`}
                      ></i>
                    </div>
                    <h3 className="m-0 text-[17px] font-bold tracking-[-0.02em] text-fg">
                      {section.title}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    {section.properties.map((prop) => (
                      <div
                        key={prop.key}
                        className={`flex flex-col gap-1.5${prop.isObject || prop.isArray ? ' col-span-full' : ''}`}
                      >
                        <label
                          className="flex items-center gap-1 text-[13px] font-semibold tracking-[-0.01em] text-fg-secondary"
                          title={prop.description}
                        >
                          {prop.key}
                          {prop.description && (
                            <i className="pi pi-info-circle cursor-help text-[11px] opacity-50"></i>
                          )}
                        </label>
                        <SparkPropertyField
                          prop={prop}
                          value={formValues[prop.key]}
                          imageOptions={imageOptions}
                          onChange={(v) => setValue(prop.key, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-end gap-3 pt-5">
              <Button severity="secondary" outlined label="Cancel" onClick={goBack} />
              <Button label="Save changes" icon="pi pi-check" loading={saving} onClick={save} />
            </div>
          </div>
        ) : (
          <div className="flex animate-in flex-col items-center justify-center gap-3 rounded-xl border border-border-light bg-surface p-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-tertiary">
              <i className="pi pi-exclamation-triangle text-[1.5rem] text-fg-muted"></i>
            </div>
            <h3 className="m-0 text-[16px] font-semibold">Job not found</h3>
            <p className="m-0 max-w-[340px] text-[14px] text-fg-secondary">
              The Spark application could not be loaded.
            </p>
            <Button
              icon="pi pi-arrow-left"
              severity="secondary"
              outlined
              label="Back to jobs"
              onClick={goBack}
            />
          </div>
        )}
      </div>
    </>
  );
}
