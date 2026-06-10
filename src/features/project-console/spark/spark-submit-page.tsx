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
import { buildSections, CORE_KEYS_SUBMIT, parseKeyValue, type SchemaSection } from './spark-utils';
import { SparkPropertyField } from './spark-property-field';
import './spark-pages.css';

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
      navigate(`/project/${projectId}/spark/applications`);
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
        navigate(`/project/${projectId}/spark/applications`);
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
        navigate(`/project/${projectId}/spark/applications`);
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

      <div className="spark-page submit-page">
        <div className="page-header">
          <nav className="breadcrumb">
            <a
              className="breadcrumb-link"
              onClick={goBack}
              onKeyDown={(e) => e.key === 'Enter' && goBack()}
              tabIndex={0}
            >
              <i className="pi pi-arrow-left breadcrumb-back-icon"></i>
              Spark Applications
            </a>
            <i className="pi pi-angle-right breadcrumb-sep"></i>
            <span className="breadcrumb-current">Submit Job</span>
          </nav>
          <div className="header-row">
            <div className="header-badge">
              <i className="pi pi-bolt"></i>
            </div>
            <div className="header-text">
              <h2>Submit Spark Application</h2>
              <p className="page-desc">Configure and submit a new Spark job or paste raw YAML</p>
            </div>
          </div>
        </div>

        <TabView>
          <TabPanel header="Guided">
            {schemaLoading ? (
              <div className="loading-state">
                <i className="pi pi-spin pi-spinner"></i>
                <span>Loading CRD schema...</span>
              </div>
            ) : (
              <div className="form-card">
                <div className="card-section">
                  <div className="section-header">
                    <div className="section-icon-badge basics">
                      <i className="pi pi-bookmark"></i>
                    </div>
                    <h3 className="section-title">Application Name</h3>
                  </div>
                  <div className="form-grid">
                    <div className="form-field full-width">
                      <label>Name *</label>
                      <InputText
                        value={appName}
                        placeholder="e.g. spark-pi"
                        onChange={(e) => setAppName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {schemaSections.map((section) => (
                  <div key={section.title} className="card-section">
                    <div className="section-header">
                      <div className={`section-icon-badge ${section.iconClass}`}>
                        <i className={'pi ' + section.icon}></i>
                      </div>
                      <h3 className="section-title">{section.title}</h3>
                    </div>
                    <div className="form-grid">
                      {section.properties.map((prop) => (
                        <div
                          key={prop.key}
                          className={`form-field${prop.isObject || prop.isArray ? ' full-width' : ''}`}
                        >
                          <label title={prop.description}>
                            {prop.key}
                            {prop.description && <i className="pi pi-info-circle info-icon"></i>}
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

                <div className="form-actions">
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
            <div className="form-card">
              <div className="form-field">
                <label>SparkApplication YAML</label>
                <InputTextarea
                  value={yamlContent}
                  rows={20}
                  placeholder="Paste your SparkApplication YAML here..."
                  className="yaml-editor"
                  onChange={(e) => setYamlContent(e.target.value)}
                />
              </div>
              <div className="form-actions">
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
