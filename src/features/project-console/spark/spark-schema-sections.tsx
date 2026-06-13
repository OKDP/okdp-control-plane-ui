/* eslint-disable @typescript-eslint/no-explicit-any */
import { SECTION_BADGE_TONES, type SchemaSection } from './spark-utils';
import { SparkPropertyField } from './spark-property-field';

export interface SparkSchemaSectionsProps {
  sections: SchemaSection[];
  formValues: Record<string, any>;
  /** Curated Spark images offered for the `image` property. */
  imageOptions: { label: string; value: string }[];
  /** Use a truncated description as the text-input placeholder (submit page). */
  descriptionPlaceholder?: boolean;
  /** Compact section chrome used by the submit page (vs the edit page's roomier layout). */
  dense?: boolean;
  onChange: (key: string, value: any) => void;
}

/**
 * The Core/Resources/Configuration section grid of a Spark application form.
 * Shared by the submit and edit pages.
 */
export function SparkSchemaSections({
  sections,
  formValues,
  imageOptions,
  descriptionPlaceholder = false,
  dense = false,
  onChange,
}: SparkSchemaSectionsProps) {
  return (
    <>
      {sections.map((section) => (
        <div
          key={section.title}
          className={`${dense ? 'py-5' : 'py-7'} first:pt-0 not-last:border-b not-last:border-b-border-light`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div
              className={`flex shrink-0 items-center justify-center ${dense ? 'h-10 w-10 rounded-md' : 'h-11 w-11 rounded-lg'} ${SECTION_BADGE_TONES[section.iconClass]?.badge ?? ''}`}
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
                  descriptionPlaceholder={descriptionPlaceholder}
                  onChange={(v) => onChange(prop.key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
