import { useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';
import { Panel } from 'primereact/panel';

/* The resource-panel class scopes the PrimeReact Panel overrides in
   styles/components/primereact-overrides.css. */
const FIELD_CLASS = 'mb-5 flex flex-col gap-1.5';
const FIELD_LABEL_CLASS = 'block text-[14px] font-semibold tracking-[-0.01em] text-fg-secondary';
const FIELD_ROW_2_CLASS = 'grid grid-cols-2 gap-3.5';

export interface Profile {
  type: string;
  image: string;
  cpuRequest: number;
  cpuLimit: number;
  memoryRequestGi: number;
  memoryLimitGi: number;
  gpuEnabled: boolean;
  gpuCount: number;
}

const DEFAULT_PROFILE: Profile = {
  type: '',
  image: '',
  cpuRequest: 0.5,
  cpuLimit: 2.0,
  memoryRequestGi: 1,
  memoryLimitGi: 4,
  gpuEnabled: false,
  gpuCount: 1,
};

const PROFILE_TYPE_OPTIONS = [
  { label: 'JupyterLab', value: 'jupyterlab' },
  { label: 'VSCode', value: 'vscode' },
  { label: 'RStudio', value: 'rstudio' },
];

// Stable default — an inline `[]` default would change identity on every
// parent render and needlessly re-run the adoption effect.
const NO_PROFILES: Profile[] = [];

export interface ProfileListEditorProps {
  profileImages: Record<string, { label: string; image: string }[]>;
  initialProfiles?: Profile[];
  onProfilesChange: (profiles: Profile[]) => void;
}

interface NumberFieldProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function ResourceNumberField({ label, value, step, min, max, onChange }: NumberFieldProps) {
  return (
    <div className={FIELD_CLASS}>
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <InputNumber
        value={value}
        showButtons
        buttonLayout="horizontal"
        step={step}
        min={min}
        max={max}
        minFractionDigits={1}
        maxFractionDigits={2}
        incrementButtonIcon="pi pi-plus"
        decrementButtonIcon="pi pi-minus"
        className="w-full"
        onValueChange={(e) => onChange(e.value ?? min)}
      />
    </div>
  );
}

export function ProfileListEditor({
  profileImages,
  initialProfiles = NO_PROFILES,
  onProfilesChange,
}: ProfileListEditorProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const onProfilesChangeRef = useRef(onProfilesChange);
  onProfilesChangeRef.current = onProfilesChange;

  // Adopt incoming profiles (legacy ngOnChanges behavior)
  useEffect(() => {
    if (initialProfiles.length > 0) {
      setProfiles(initialProfiles.map((p) => ({ ...DEFAULT_PROFILE, ...p })));
    }
  }, [initialProfiles]);

  useEffect(() => {
    onProfilesChangeRef.current(profiles);
  }, [profiles]);

  const getImagesForType = (type: string) => profileImages[type] || [];

  const updateProfile = (index: number, patch: Partial<Profile>) => {
    setProfiles((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const addProfile = () => setProfiles((list) => [...list, { ...DEFAULT_PROFILE }]);

  const removeProfile = (index: number) =>
    setProfiles((list) => list.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3">
      {profiles.map((profile, index) => (
        <div
          key={index}
          className="animate-[fadeInUp_var(--db-transition-spring)_backwards] overflow-hidden rounded-xl border border-border-light bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] [transition:box-shadow_0.3s_ease,border-color_0.3s_ease,transform_var(--db-transition-spring)] hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
        >
          <div className="flex items-center justify-between border-b border-border-light bg-surface-secondary px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-[12px] font-semibold text-white">
                {index + 1}
              </span>
              <span className="text-[15px] font-bold tracking-[-0.02em] text-fg">
                Profile {index + 1}
              </span>
            </div>
            <Button
              icon="pi pi-times"
              text
              rounded
              severity="danger"
              title="Remove this profile"
              onClick={() => removeProfile(index)}
            />
          </div>

          <div className="flex flex-col gap-4 p-4">
            <div className={FIELD_ROW_2_CLASS}>
              <div className={FIELD_CLASS}>
                <label className={FIELD_LABEL_CLASS}>Type</label>
                <Dropdown
                  value={profile.type}
                  options={PROFILE_TYPE_OPTIONS}
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Select type"
                  appendTo={document.body}
                  className="w-full"
                  onChange={(e) => updateProfile(index, { type: e.value, image: '' })}
                />
              </div>
              <div className={FIELD_CLASS}>
                <label className={FIELD_LABEL_CLASS}>Image</label>
                <Dropdown
                  value={profile.image}
                  options={getImagesForType(profile.type)}
                  optionLabel="label"
                  optionValue="image"
                  placeholder="Select image"
                  disabled={!profile.type}
                  appendTo={document.body}
                  className="w-full"
                  onChange={(e) => updateProfile(index, { image: e.value })}
                />
              </div>
            </div>

            <Panel header="Resources" toggleable collapsed className="resource-panel">
              <div className={FIELD_ROW_2_CLASS}>
                <ResourceNumberField
                  label="CPU Request (vCPU)"
                  value={profile.cpuRequest}
                  step={0.25}
                  min={0.25}
                  max={16}
                  onChange={(v) => updateProfile(index, { cpuRequest: v })}
                />
                <ResourceNumberField
                  label="CPU Limit (vCPU)"
                  value={profile.cpuLimit}
                  step={0.25}
                  min={0.25}
                  max={64}
                  onChange={(v) => updateProfile(index, { cpuLimit: v })}
                />
              </div>
              <div className={FIELD_ROW_2_CLASS}>
                <ResourceNumberField
                  label="Memory Request (GiB)"
                  value={profile.memoryRequestGi}
                  step={0.25}
                  min={0.25}
                  max={64}
                  onChange={(v) => updateProfile(index, { memoryRequestGi: v })}
                />
                <ResourceNumberField
                  label="Memory Limit (GiB)"
                  value={profile.memoryLimitGi}
                  step={0.25}
                  min={0.25}
                  max={256}
                  onChange={(v) => updateProfile(index, { memoryLimitGi: v })}
                />
              </div>
              <div className={FIELD_CLASS}>
                <label className={FIELD_LABEL_CLASS}>GPU</label>
                <div className="flex items-center gap-3.5">
                  <InputSwitch
                    checked={profile.gpuEnabled}
                    onChange={(e) => updateProfile(index, { gpuEnabled: !!e.value })}
                  />
                  {profile.gpuEnabled && (
                    <InputNumber
                      value={profile.gpuCount}
                      showButtons
                      min={1}
                      max={8}
                      className="w-[120px]"
                      onValueChange={(e) => updateProfile(index, { gpuCount: e.value ?? 1 })}
                    />
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      ))}

      <Button
        label="Add profile"
        icon="pi pi-plus"
        outlined
        severity="secondary"
        className="w-full"
        onClick={addProfile}
      />
    </div>
  );
}
