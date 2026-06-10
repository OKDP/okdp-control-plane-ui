/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { sparkApi } from '../../../core/api/spark-api';
import type { SparkAppInstance, SparkAppUpdateRequest } from '../../../core/models/spark.model';
import { apiErrorMessage } from '../services/service-utils';
import { buildSections, CORE_KEYS_EDIT, parseKeyValue, type SchemaSection } from './spark-utils';
import { SparkPropertyField } from './spark-property-field';
import './spark-pages.css';

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

      <div className="spark-page edit-page">
        <div className="page-header animate-in">
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
            <span className="breadcrumb-current">Edit {app?.name}</span>
          </nav>
          <div className="header-row">
            <div className="header-badge">
              <i className="pi pi-pencil"></i>
            </div>
            <div className="header-text">
              <h2>Edit Spark Job</h2>
              <p className="page-desc">Modify configuration for {app?.name}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state animate-in">
            <div className="loading-spinner-ring">
              <i className="pi pi-spin pi-spinner"></i>
            </div>
            <p>Loading job configuration...</p>
          </div>
        ) : app ? (
          <div className="edit-form-container animate-in">
            <div className="form-card">
              <div className="card-section">
                <div className="section-header">
                  <div className="section-icon-badge basics">
                    <i className="pi pi-bookmark"></i>
                  </div>
                  <h3 className="section-title">Application</h3>
                </div>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Name</label>
                    <div className="readonly-value">{app.name}</div>
                  </div>
                  <div className="form-field">
                    <label>Type</label>
                    <div className="readonly-value">{app.type}</div>
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
                          onChange={(v) => setValue(prop.key, v)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <Button severity="secondary" outlined label="Cancel" onClick={goBack} />
              <Button label="Save changes" icon="pi pi-check" loading={saving} onClick={save} />
            </div>
          </div>
        ) : (
          <div className="empty-state animate-in">
            <div className="empty-icon-wrapper">
              <i className="pi pi-exclamation-triangle empty-icon"></i>
            </div>
            <h3>Job not found</h3>
            <p>The Spark application could not be loaded.</p>
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
