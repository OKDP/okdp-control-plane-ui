/* eslint-disable @typescript-eslint/no-explicit-any */
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { InputTextarea } from 'primereact/inputtextarea';
import { toOptions, type SchemaProperty } from './spark-utils';

export interface SparkPropertyFieldProps {
  prop: SchemaProperty;
  value: any;
  /** Curated Spark images offered for the `image` property. */
  imageOptions: { label: string; value: string }[];
  /** Use a truncated description as the text-input placeholder (submit page). */
  descriptionPlaceholder?: boolean;
  onChange: (value: any) => void;
}

/**
 * Widget for one CRD schema property of a Spark application form.
 * Shared by the submit and edit pages.
 */
export function SparkPropertyField({
  prop,
  value,
  imageOptions,
  descriptionPlaceholder = false,
  onChange,
}: SparkPropertyFieldProps) {
  if (prop.enumValues && prop.enumValues.length > 0) {
    return (
      <Dropdown
        value={value}
        options={toOptions(prop.enumValues)}
        optionLabel="label"
        optionValue="value"
        placeholder={`Select ${prop.key}`}
        appendTo={document.body}
        className="w-full"
        onChange={(e) => onChange(e.value)}
      />
    );
  }
  if (prop.key === 'image' && imageOptions.length > 0) {
    return (
      <Dropdown
        value={value}
        options={imageOptions}
        optionLabel="label"
        optionValue="value"
        placeholder="Select image"
        appendTo={document.body}
        className="w-full"
        editable
        onChange={(e) => onChange(e.value)}
      />
    );
  }
  if (prop.type === 'integer') {
    return (
      <InputNumber
        value={value ?? null}
        showButtons
        min={0}
        className="w-full"
        onValueChange={(e) => onChange(e.value)}
      />
    );
  }
  if (prop.type === 'boolean') {
    return <InputSwitch checked={!!value} onChange={(e) => onChange(e.value)} />;
  }
  if (prop.isObject) {
    return (
      <InputTextarea
        value={value ?? ''}
        rows={3}
        className="w-full text-[13px]! [font-family:monospace]!"
        placeholder="key=value (one per line)"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (prop.isArray) {
    return (
      <InputText
        value={value ?? ''}
        className="w-full"
        placeholder="Comma-separated values"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const placeholder =
    descriptionPlaceholder && prop.description
      ? prop.description.length > 60
        ? prop.description.substring(0, 60) + '...'
        : prop.description
      : '';
  return (
    <InputText
      value={value ?? ''}
      className="w-full"
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
