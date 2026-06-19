/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { TabPanel, TabView } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import { sparkApi } from '../../../core/api/spark-api';
import type { SparkAppRequest, SparkImage } from '../../../core/models/spark.model';
import { apiErrorMessage } from '../services/service-utils';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import {
  applyResourceFormValues,
  buildSections,
  CORE_KEYS_SUBMIT,
  FALLBACK_SECTIONS,
  type SchemaSection,
} from './spark-utils';
import { SparkSchemaSections } from './spark-schema-sections';

export default function SparkSubmitPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { toast, showSuccess, showError } = useToastMessages();

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
      navigate(`/projects/${projectId}/views/spark/applications`);
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

    applyResourceFormValues(req, formValues, {
      driverCores: 1,
      executorInstances: 2,
      executorCores: 1,
    });

    sparkApi
      .submitApp(projectId, req)
      .then(() => {
        showSuccess(`Spark job "${req.name}" submitted`, 'Submitted');
        navigate(`/projects/${projectId}/views/spark/applications`);
      })
      .catch((err) => {
        showError(apiErrorMessage(err, 'Failed to submit Spark job'));
        setSubmitting(false);
      });
  };

  const submitYAML = () => {
    if (!projectId) return;

    setSubmitting(true);

    sparkApi
      .submitAppYAML(projectId, { yaml: yamlContent })
      .then(() => {
        showSuccess('Spark job submitted from YAML', 'Submitted');
        navigate(`/projects/${projectId}/views/spark/applications`);
      })
      .catch((err) => {
        showError(apiErrorMessage(err, 'Failed to submit Spark job'));
        setSubmitting(false);
      });
  };

  return (
    <>
      <Toast ref={toast} />

      <div className="mx-auto w-full max-w-(--db-form-width) pt-3">
        <div className="mb-5">
          <nav className="breadcrumb">
            <a
              className="breadcrumb-link"
              onClick={goBack}
              onKeyDown={(e) => e.key === 'Enter' && goBack()}
              tabIndex={0}
            >
              <i className="pi pi-arrow-left text-[11px]"></i>
              Spark Jobs
            </a>
            <i className="pi pi-angle-right text-[10px] text-fg-muted"></i>
            <span className="breadcrumb-current">Submit Job</span>
          </nav>
          <div className="header-row">
            <div className="header-badge amber">
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

                <SparkSchemaSections
                  sections={schemaSections}
                  formValues={formValues}
                  imageOptions={imageOptions}
                  descriptionPlaceholder
                  dense
                  onChange={setValue}
                />

                <div className="deploy-actions mt-5 flex justify-end gap-2 border-t border-t-border-light pt-3">
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
                  className="w-full resize-y text-[13px]! mono!"
                  onChange={(e) => setYamlContent(e.target.value)}
                />
              </div>
              <div className="deploy-actions mt-5 flex justify-end gap-2 border-t border-t-border-light pt-3">
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
