/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Dropdown } from 'primereact/dropdown';
import { Toast } from 'primereact/toast';
import { serviceApi, type PackageInput } from '../../../core/api/service-api';
import { ConnectionInputPicker } from '../connections/connection-input-picker';
import type { ServiceInstance } from '../../../core/models/service.model';
import { DynamicSchemaForm } from '../../../shared/components/dynamic-schema-form';
import EmptyState from '../../../shared/components/empty-state';
import { ProfileListEditor, type Profile } from '../../../shared/components/profile-list-editor';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import {
  apiErrorMessage,
  areaBasePath,
  hasProfileEditorWidget,
  instancePhase,
  isTransitioning,
  parentLabel,
  safeReturnTo,
  statusTone,
  useServiceSchema,
  versionOptionsFor,
} from './service-utils';
import { StatusTag } from '../../../shared/components/status-tag';
import {
  classifyWrite,
  classifyWriteError,
  CONFLICT_DETAIL,
  UNKNOWN_WRITE_DETAIL,
  type WriteOutcome,
} from './write-outcome';
import { withNotice } from '../../../shared/hooks/use-route-notice';

export default function ServiceEditPage() {
  const navigate = useNavigate();
  const { projectId: projectName, serviceName } = useParams<{
    projectId: string;
    serviceName: string;
  }>();
  const [searchParams] = useSearchParams();
  const { toast, showError, showWarn } = useToastMessages();

  const [instance, setInstance] = useState<ServiceInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Mirrors the validity state of the dynamic schema form so Save can be
  // disabled when a CPU/memory quantity is malformed (e.g. "1" instead of
  // "1Gi"). Starts true so an untouched form with valid defaults is saveable.
  const [paramsValid, setParamsValid] = useState(true);
  const {
    schema: rawSchema,
    setSchema: setRawSchema,
    schemaLoading,
    loadSchema,
  } = useServiceSchema(showWarn, 'Could not load configuration schema.');
  const [profileImages, setProfileImages] = useState<
    Record<string, { label: string; image: string }[]>
  >({});
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  // Connections the package declares. They get a picker rather than a text
  // field, so changing a database offers what satisfies the contract instead of
  // asking for a name from memory.
  const [packageInputs, setPackageInputs] = useState<PackageInput[]>([]);
  const [connectionChoices, setConnectionChoices] = useState<Record<string, string>>({});
  // Disable Save until connection inputs finish loading, so choices match the
  // loaded instance revision.
  const [inputsSettled, setInputsSettled] = useState(false);
  const [existingProfiles, setExistingProfiles] = useState<Profile[]>([]);
  const [versionOptions, setVersionOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  // Set by a 409 on save: the form edits a revision the instance moved past,
  // so saving again would hit the same conflict until the instance is reread.
  const [conflict, setConflict] = useState(false);
  // Bumped by Reload. Also keys the form widgets, which read their initial
  // values once.
  const [reloadKey, setReloadKey] = useState(0);

  const originalTagRef = useRef('');
  const parametersRef = useRef<Record<string, any>>({});
  const profilesRef = useRef<Profile[]>([]);
  // Bumped on scope change and unmount so a slow write cannot navigate after
  // the user already moved elsewhere.
  const activeScopeRef = useRef(0);

  useEffect(() => {
    activeScopeRef.current += 1;
    setSaving(false);
    return () => {
      activeScopeRef.current += 1;
    };
  }, [projectName, serviceName]);

  const hasPendingChanges = selectedTag !== originalTagRef.current;

  // The parameters a connection input owns get a picker. Leaving them in the
  // schema form would render the same choice twice, once as a raw string.
  const visibleSchema = useMemo(() => {
    if (!rawSchema?.properties || packageInputs.length === 0) {
      return rawSchema;
    }
    const claimed = new Set(packageInputs.map((input) => input.parameter));
    return {
      ...rawSchema,
      properties: Object.fromEntries(
        Object.entries(rawSchema.properties).filter(([key]) => !claimed.has(key)),
      ),
    };
  }, [rawSchema, packageInputs]);

  useEffect(() => {
    if (!projectName || !serviceName) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setInstance(null);
    setConflict(false);
    setInputsSettled(false);
    Promise.all([
      // Always bypass the GET cache so the form starts from the current
      // revision instead of a stale cached read that would 409 on save.
      serviceApi.getService(projectName, serviceName, true),
      serviceApi.getProfileImages(),
      serviceApi.getPlatformServices(),
    ])
      .then(([inst, images, platformServices]) => {
        if (cancelled) return;
        setInstance(inst);
        setProfileImages(images);

        setSelectedTag(inst.serviceTag);
        originalTagRef.current = inst.serviceTag;

        const svc = platformServices.find((s) => s.name === inst.service);
        if (svc) {
          setVersionOptions(versionOptionsFor(svc));
        }

        const { profiles, ...params } = inst.parameters || {};
        setParameterValues(params);
        parametersRef.current = { ...params };

        serviceApi
          .getServiceInputs(inst.service, inst.serviceTag)
          .then((inputs) => {
            if (cancelled) return;
            const offered = inputs.filter((input) => !!input.parameter);
            setPackageInputs(offered);
            setConnectionChoices(
              Object.fromEntries(
                offered.map((input) => [input.parameter!, String(params[input.parameter!] ?? '')]),
              ),
            );
            setInputsSettled(true);
          })
          // A package without inputs, or an older server: nothing to offer, and
          // the parameters stay as they are.
          .catch(() => {
            if (cancelled) return;
            setPackageInputs([]);
            setInputsSettled(true);
          });

        const loadedProfiles = Array.isArray(profiles) ? profiles : [];
        setExistingProfiles(loadedProfiles);
        profilesRef.current = [...loadedProfiles];
        setConflict(false);

        loadSchema(inst.service, inst.serviceTag);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        showError('Failed to load instance');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, serviceName, loadSchema, showError, reloadKey]);

  const onVersionChange = (tag: string) => {
    if (!instance || !tag) return;
    setSelectedTag(tag);
    setRawSchema(null);
    loadSchema(instance.service, tag);
  };

  const navigateBack = (project: string, state?: ReturnType<typeof withNotice>) => {
    const returnTo = safeReturnTo(searchParams.get('returnTo'));
    if (returnTo) {
      navigate(returnTo, { state });
    } else {
      navigate(
        `/projects/${encodeURIComponent(project)}/${areaBasePath(instance?.service).map(encodeURIComponent).join('/')}`,
        { state },
      );
    }
  };

  const goBack = () => {
    if (projectName) {
      navigateBack(projectName);
    }
  };

  const save = () => {
    if (!projectName || !instance) return;

    setSaving(true);
    // Only include `profiles` when the service schema actually expects it
    // (e.g. JupyterHub). Other services (Trino, Polaris, Superset, Airflow)
    // have `additionalProperties: false` and reject unknown keys.
    const mergedParams: Record<string, any> = { ...parametersRef.current };
    // The pickers own their parameters, and the schema form no longer sees
    // them. An empty choice is left out rather than written blank, so a package
    // default resolved against the Environment keeps applying.
    for (const input of packageInputs) {
      const chosen = connectionChoices[input.parameter!];
      if (chosen) {
        mergedParams[input.parameter!] = chosen;
      } else {
        delete mergedParams[input.parameter!];
      }
    }
    if (hasProfileEditorWidget(rawSchema)) {
      mergedParams['profiles'] = profilesRef.current;
    }
    const body: { tag?: string; parameters: Record<string, any> } = { parameters: mergedParams };
    if (selectedTag && selectedTag !== originalTagRef.current) {
      body.tag = selectedTag;
    }
    const scope = activeScopeRef.current;
    const settle = (outcome: WriteOutcome) => {
      if (scope !== activeScopeRef.current) return;
      setSaving(false);
      if (outcome.kind === 'rejected') {
        showError(outcome.message, 'Changes refused');
        return;
      }
      if (outcome.kind === 'conflict') {
        setConflict(true);
        return;
      }
      if (outcome.kind === 'unknown') {
        const area = `/projects/${encodeURIComponent(projectName)}/${areaBasePath(instance.service).map(encodeURIComponent).join('/')}`;
        const returnTo = safeReturnTo(searchParams.get('returnTo')) ?? area;
        navigate(
          `${area}/${encodeURIComponent(instance.name)}?returnTo=${encodeURIComponent(returnTo)}`,
          {
            state: withNotice({
              severity: 'warn',
              summary: 'Changes not confirmed',
              detail: UNKNOWN_WRITE_DETAIL,
            }),
          },
        );
        return;
      }
      navigateBack(
        projectName,
        withNotice({
          severity: 'success',
          summary: 'Changes saved',
          detail: `${instance.name} has been updated.`,
        }),
      );
    };

    serviceApi
      .updateServiceParameters(projectName, instance.name, body, instance.desiredRevision)
      .then((result) => settle(classifyWrite(result)))
      .catch((err) => {
        if (scope !== activeScopeRef.current) return;
        const outcome = classifyWriteError(err);
        if (outcome) {
          settle(outcome);
          return;
        }
        showError(apiErrorMessage(err, 'Failed to save changes'));
        setSaving(false);
      });
  };

  return (
    <>
      <Toast ref={toast} />

      <div className="deploy-page animate-in">
        <div className="page-header">
          <nav className="breadcrumb">
            <a
              className="breadcrumb-link"
              onClick={goBack}
              onKeyDown={(e) => e.key === 'Enter' && goBack()}
              tabIndex={0}
            >
              <i className="pi pi-arrow-left text-[11px]"></i>
              {parentLabel(instance?.service)}
            </a>
            <i className="pi pi-angle-right text-[10px] text-fg-muted"></i>
            <a className="breadcrumb-link" onClick={goBack} tabIndex={0}>
              {instance?.name}
            </a>
            <i className="pi pi-angle-right text-[10px] text-fg-muted"></i>
            <span className="breadcrumb-current">Edit</span>
          </nav>

          {instance && (
            <div className="header-row">
              <div className="header-badge">
                <i className="pi pi-pencil"></i>
              </div>
              <div className="header-text">
                <div className="header-title-row">
                  <h2>
                    Edit{' '}
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {instance.name}
                    </span>
                  </h2>
                  <StatusTag
                    value={instancePhase(instance)}
                    tone={statusTone(instancePhase(instance))}
                    pulse={isTransitioning(instancePhase(instance))}
                  />
                </div>
                <p className="page-desc">
                  Change version, parameters or profiles. Saving will trigger a rolling restart.
                </p>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <EmptyState
            variant="panel"
            icon="pi pi-spin pi-spinner"
            title="Loading instance configuration…"
          />
        ) : instance ? (
          <>
            {hasPendingChanges && instancePhase(instance) === 'Ready' && (
              <div className="edit-banner">
                <i className="pi pi-info-circle"></i>
                <div>
                  <strong>A restart will be required.</strong>
                  <span className="muted-text">
                    Running kernels will be interrupted. Unsaved notebook changes are preserved on
                    the persistent volume.
                  </span>
                </div>
              </div>
            )}

            {conflict && (
              <div className="alert alert-danger mb-4" role="alert">
                <i className="pi pi-exclamation-circle"></i>
                <div className="flex-1">
                  <strong>Changes not saved</strong>
                  <p>{CONFLICT_DETAIL}</p>
                </div>
                <button className="btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>
                  <i className="pi pi-refresh"></i>
                  Reload
                </button>
              </div>
            )}

            <div className="form-card">
              <div className="form-section">
                <div className="form-field">
                  <label>Instance name</label>
                  <input className="text-input mono" value={instance.name} disabled />
                  <small className="field-hint">Name cannot be changed after creation.</small>
                </div>

                <div className="form-field">
                  <div className="field-head">
                    <label style={{ margin: 0 }}>Version</label>
                    <span className="muted-text small mono">{instance.service}</span>
                  </div>
                  <small className="field-hint" style={{ marginTop: 0, marginBottom: '10px' }}>
                    Currently <span className="mono">{instance.serviceTag}</span>. Changing the tag
                    reloads the parameter schema.
                  </small>
                  {versionOptions.length > 0 ? (
                    <Dropdown
                      value={selectedTag}
                      options={versionOptions}
                      optionLabel="label"
                      optionValue="value"
                      appendTo={document.body}
                      className="w-full"
                      onChange={(e) => onVersionChange(e.value)}
                    />
                  ) : (
                    <span className="version-badge mono">{instance.serviceTag}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-card" style={{ marginTop: '14px' }}>
              {schemaLoading ? (
                <div className="form-section">
                  <div className="flex items-center gap-3 py-2">
                    <i className="pi pi-spin pi-spinner text-[18px] text-primary"></i>
                    <div>
                      <strong>Loading configuration schema…</strong>
                      <div className="muted-text small">
                        Fetching {instance.service}:{selectedTag}
                      </div>
                    </div>
                  </div>
                </div>
              ) : rawSchema ? (
                <div className="form-section">
                  {packageInputs.map((input) => (
                    <ConnectionInputPicker
                      key={input.alias}
                      projectId={projectName!}
                      input={input}
                      value={connectionChoices[input.parameter!] ?? ''}
                      onChange={(connectionName) =>
                        setConnectionChoices((choices) => ({
                          ...choices,
                          [input.parameter!]: connectionName,
                        }))
                      }
                    />
                  ))}
                  <DynamicSchemaForm
                    key={reloadKey}
                    schema={visibleSchema}
                    projectId={projectName}
                    initialValues={parameterValues}
                    onParametersChange={(params) => {
                      parametersRef.current = params;
                    }}
                    onValidityChange={setParamsValid}
                  />
                </div>
              ) : null}

              {(existingProfiles.length > 0 || hasProfileEditorWidget(rawSchema)) && (
                <div className="form-section" style={{ marginTop: '20px' }}>
                  <div className="field-head">
                    <label style={{ margin: 0 }}>Profiles</label>
                    <span className="muted-text small">
                      Notebook environments users can launch.
                    </span>
                  </div>
                  <ProfileListEditor
                    key={reloadKey}
                    profileImages={profileImages}
                    initialProfiles={existingProfiles}
                    onProfilesChange={(profiles) => {
                      profilesRef.current = profiles;
                    }}
                  />
                </div>
              )}
            </div>

            <div className="wizard-actions">
              <button className="btn-secondary" onClick={goBack} disabled={saving}>
                Cancel
              </button>
              <div className="wa-right">
                <button
                  className="create-btn"
                  onClick={save}
                  disabled={saving || !paramsValid || conflict || !inputsSettled}
                >
                  {saving ? (
                    <>
                      <i className="pi pi-spin pi-spinner"></i>
                      Saving…
                    </>
                  ) : (
                    <>
                      <i className="pi pi-check"></i>
                      Save changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            variant="panel"
            icon="pi pi-exclamation-triangle"
            title="Instance not found"
            description="The service instance could not be loaded."
            action={
              <button className="btn-secondary" onClick={goBack}>
                <i className="pi pi-arrow-left"></i>
                Back to instances
              </button>
            }
          />
        )}
      </div>
    </>
  );
}
