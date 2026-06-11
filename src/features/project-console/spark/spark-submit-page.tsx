/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { TabPanel, TabView } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import { sparkApi } from '../../../core/api/spark-api';
import type { SparkAppRequest, SparkImage } from '../../../core/models/spark.model';
import { apiErrorMessage } from '../services/service-utils';
import {
  buildSections,
  CORE_KEYS_SUBMIT,
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
];

export default function SparkSubmitPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useRef<Toast>(null);

  const [sparkImages, setSparkImages] = useState<SparkImage[]>([]);
  const [schemaSections, setSchemaSections] = useState<SchemaSection[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [appName, setAppName] = useState('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [yamlContent, setYamlContent] = useState('');

  const setValue = (key: string, value: any) => setFormValues((v) => ({ ...v, [key]: value }));

  const imageOptions = useMemo(
    () => sparkImages.map((i) => ({ label: i.label, value: i.image })),
    [sparkImages],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([sparkApi.getAppSchema(), sparkApi.getSparkConfig()])
      .then(([schema, config]) => {
        if (cancelled) return;
        setSchemaSections(buildSections(schema, CORE_KEYS_SUBMIT));
        setSparkImages(config.spark?.images || []);
        if (config.spark?.defaults) {
          const d = config.spark.defaults;
          setFormValues((v) => ({
            ...v,
            driver: `cores=${d.driver.cores}\nmemory=${d.driver.memory}`,
            executor: `instances=${d.executor.instances}\ncores=${d.executor.cores}\nmemory=${d.executor.memory}`,
          }));
        }
        setSchemaLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSchemaSections(FALLBACK_SECTIONS);
        setSchemaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goBack = () => {
    if (projectId) {
      navigate(`/projects/${projectId}/spark/applications`);
    }
  };

  const submitGuided = () => {
    if (!projectId) return;

    setSubmitting(true);

    const req: SparkAppRequest = {
      name: appName,
      type: (formValues['type'] || 'Java') as SparkAppRequest['type'],
      mode: formValues['mode'] || 'cluster',
      image: formValues['image'] || '',
      mainClass: formValues['mainClass'] || undefined,
      mainApplicationFile: formValues['mainApplicationFile'] || undefined,
      sparkVersion: formValues['sparkVersion'] || undefined,
    };

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
      if (parsed['cores']) req.driverCores = parseInt(parsed['cores'], 10) || 1;
      if (parsed['memory']) req.driverMemory = parsed['memory'];
    }

    const executorStr = formValues['executor'];
    if (executorStr && typeof executorStr === 'string') {
      const parsed = parseKeyValue(executorStr);
      if (parsed['instances']) req.executorInstances = parseInt(parsed['instances'], 10) || 2;
      if (parsed['cores']) req.executorCores = parseInt(parsed['cores'], 10) || 1;
      if (parsed['memory']) req.executorMemory = parsed['memory'];
    }

    const sparkConfStr = formValues['sparkConf'];
    if (sparkConfStr && typeof sparkConfStr === 'string') {
      req.sparkConf = parseKeyValue(sparkConfStr);
    }

    sparkApi
      .submitApp(projectId, req)
      .then(() => {
        toast.current?.show({
          severity: 'success',
          summary: 'Submitted',
          detail: `Spark job "${req.name}" submitted`,
        });
        navigate(`/projects/${projectId}/spark/applications`);
      })
      .catch((err) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: apiErrorMessage(err, 'Failed to submit Spark job'),
        });
        setSubmitting(false);
      });
  };

  const submitYAML = () => {
    if (!projectId) return;

    setSubmitting(true);

    sparkApi
      .submitAppYAML(projectId, { yaml: yamlContent })
      .then(() => {
        toast.current?.show({
          severity: 'success',
          summary: 'Submitted',
          detail: 'Spark job submitted from YAML',
        });
        navigate(`/projects/${projectId}/spark/applications`);
      })
      .catch((err) => {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: apiErrorMessage(err, 'Failed to submit Spark job'),
        });
        setSubmitting(false);
      });
  };

  return (
    <>
      <Toast ref={toast} />

      <div className="mx-auto max-w-[860px] pt-3">
        <div className="mb-7">
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
            <span className="text-[13px] font-medium text-fg-muted">Submit Job</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-[0_6px_16px_rgba(245,158,11,0.25)] [background:linear-gradient(135deg,#f59e0b,#d97706)]">
              <i className="pi pi-bolt text-[1.4rem] text-white"></i>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[28px] leading-[1.2] font-extrabold tracking-[-0.03em] text-fg">
                Submit Spark Application
              </h2>
              <p className="mt-1.5 mb-0 text-[15px] text-fg-secondary">
                Configure and submit a new Spark job or paste raw YAML
              </p>
            </div>
          </div>
        </div>

        <TabView>
          <TabPanel header="Guided">
            {schemaLoading ? (
              <div className="flex flex-row items-center justify-center gap-2 p-7 text-[14px] text-fg-secondary">
                <i className="pi pi-spin pi-spinner text-[1.2rem]"></i>
                <span>Loading CRD schema...</span>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-border-light bg-surface p-7 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
                <div className="py-5 first:pt-0 not-last:border-b not-last:border-b-border-light">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50">
                      <i className="pi pi-bookmark text-[1rem] text-primary"></i>
                    </div>
                    <h3 className="m-0 text-[17px] font-bold tracking-[-0.02em] text-fg">
                      Application Name
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    <div className="col-span-full flex flex-col gap-1.5">
                      <label className="flex items-center gap-1 text-[13px] font-semibold tracking-[-0.01em] text-fg-secondary">
                        Name *
                      </label>
                      <InputText
                        value={appName}
                        placeholder="e.g. spark-pi"
                        onChange={(e) => setAppName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {schemaSections.map((section) => (
                  <div
                    key={section.title}
                    className="py-5 first:pt-0 not-last:border-b not-last:border-b-border-light"
                  >
                    <div className="mb-5 flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${SECTION_BADGE_TONES[section.iconClass]?.badge ?? ''}`}
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
                            descriptionPlaceholder
                            onChange={(v) => setValue(prop.key, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="mt-5 flex justify-end gap-2 border-t border-t-border-light pt-3">
                  <Button label="Cancel" severity="secondary" outlined onClick={goBack} />
                  <Button
                    label="Submit"
                    icon="pi pi-send"
                    loading={submitting}
                    disabled={!appName || !formValues['type']}
                    onClick={submitGuided}
                  />
                </div>
              </div>
            )}
          </TabPanel>
          <TabPanel header="YAML">
            <div className="mt-3 rounded-xl border border-border-light bg-surface p-7 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1 text-[13px] font-semibold tracking-[-0.01em] text-fg-secondary">
                  SparkApplication YAML
                </label>
                <InputTextarea
                  value={yamlContent}
                  rows={20}
                  placeholder="Paste your SparkApplication YAML here..."
                  className="w-full resize-y text-[13px]! [font-family:monospace]!"
                  onChange={(e) => setYamlContent(e.target.value)}
                />
              </div>
              <div className="mt-5 flex justify-end gap-2 border-t border-t-border-light pt-3">
                <Button label="Cancel" severity="secondary" outlined onClick={goBack} />
                <Button
                  label="Submit YAML"
                  icon="pi pi-send"
                  loading={submitting}
                  disabled={!yamlContent.trim()}
                  onClick={submitYAML}
                />
              </div>
            </div>
          </TabPanel>
        </TabView>
      </div>
    </>
  );
}
