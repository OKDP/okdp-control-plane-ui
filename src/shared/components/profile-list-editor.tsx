import { useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputSwitch } from 'primereact/inputswitch';
import { Panel } from 'primereact/panel';
import './profile-list-editor.css';

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
    <div className="field">
      <label>{label}</label>
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
    <div className="profile-list">
      {profiles.map((profile, index) => (
        <div key={index} className="profile-card">
          <div className="profile-header">
            <div className="profile-header-left">
              <span className="profile-number">{index + 1}</span>
              <span className="profile-label">Profile {index + 1}</span>
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

          <div className="profile-body">
            <div className="field-row-2">
              <div className="field">
                <label>Type</label>
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
              <div className="field">
                <label>Image</label>
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
              <div className="field-row-2">
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
              <div className="field-row-2">
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
              <div className="field">
                <label>GPU</label>
                <div className="gpu-row">
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
                      className="gpu-count"
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
