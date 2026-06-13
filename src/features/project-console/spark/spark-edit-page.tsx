/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { sparkApi } from '../../../core/api/spark-api';
import type { SparkAppInstance, SparkAppUpdateRequest } from '../../../core/models/spark.model';
import { apiErrorMessage } from '../services/service-utils';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import EmptyState from '../../../shared/components/empty-state';
import {
  applyResourceFormValues,
  buildSections,
  CORE_KEYS_EDIT,
  FALLBACK_SECTIONS,
  type SchemaSection,
} from './spark-utils';
import { SparkSchemaSections } from './spark-schema-sections';

// 'type' and 'mode' are read-only on the edit page.
const EDIT_FALLBACK_SECTIONS: SchemaSection[] = FALLBACK_SECTIONS.map((s) =>
  s.title === 'Core'
    ? { ...s, properties: s.properties.filter((p) => p.key !== 'type' && p.key !== 'mode') }
    : s,
);

export default function SparkEditPage() {
  const navigate = useNavigate();
  const { projectId: projectName, appName = '' } = useParams<{
    projectId: string;
    appName: string;
  }>();
  const { toast, showSuccess, showError } = useToastMessages();

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

        setFormValues((v) => ({ ...v, image: appData.image }));

        if (schema) {
          setSchemaSections(buildSections(schema, CORE_KEYS_EDIT));
        } else {
          setSchemaSections(EDIT_FALLBACK_SECTIONS);
        }

        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        showError('Failed to load Spark job');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, appName, showError]);

  const goBack = () => {
    if (projectName && app) {
      navigate(`/projects/${projectName}/views/spark/applications/${app.name}`);
    } else if (projectName) {
      navigate(`/projects/${projectName}/views/spark/applications`);
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

    applyResourceFormValues(req, formValues);

    sparkApi
      .updateApp(projectName, app.name, req)
      .then(() => {
        showSuccess(`Spark job "${app.name}" has been updated`, 'Saved');
        setSaving(false);
        navigate(`/projects/${projectName}/views/spark/applications/${app.name}`);
      })
      .catch((err) => {
        showError(apiErrorMessage(err, 'Failed to save changes'));
        setSaving(false);
      });
  };

  return (
    <>
      <Toast ref={toast} />

      <div className="mx-auto w-full max-w-(--db-form-width) pt-3">
        <div className="mb-5 animate-in">
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
            <span className="breadcrumb-current">Edit {app?.name}</span>
          </nav>
          <div className="header-row">
            <div className="header-badge amber">
              <i className="pi pi-pencil"></i>
            </div>
            <div className="header-text">
              <h2>Edit Spark Job</h2>
              <p className="page-desc">Modify configuration for {app?.name}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <EmptyState
            variant="panel"
            icon="pi pi-spin pi-spinner"
            title="Loading job configuration..."
          />
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
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1 text-[13px] font-semibold tracking-[-0.01em] text-fg-secondary">
                      Mode
                    </label>
                    <div className="rounded-md border border-border-light bg-surface-secondary px-3 py-2.5 text-[14px] font-medium text-fg">
                      {app.mode}
                    </div>
                  </div>
                </div>
              </div>

              <SparkSchemaSections
                sections={schemaSections}
                formValues={formValues}
                imageOptions={imageOptions}
                onChange={setValue}
              />
            </div>

            <div className="deploy-actions mt-2 flex items-center justify-end gap-3 pt-5">
              <Button severity="secondary" outlined label="Cancel" onClick={goBack} />
              <Button label="Save changes" icon="pi pi-check" loading={saving} onClick={save} />
            </div>
          </div>
        ) : (
          <EmptyState
            variant="panel"
            icon="pi pi-exclamation-triangle"
            title="Job not found"
            description="The Spark application could not be loaded."
            action={
              <Button
                icon="pi pi-arrow-left"
                severity="secondary"
                outlined
                label="Back to jobs"
                onClick={goBack}
              />
            }
          />
        )}
      </div>
    </>
  );
}
