import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DynamicSchemaForm } from './dynamic-schema-form';

const schema = {
  properties: {
    name: { type: 'string', default: 'demo' },
    replicas: { type: 'integer', default: 2 },
  },
};

describe('DynamicSchemaForm', () => {
  // Regression: an inline `initialValues = {}` default changed identity on
  // every render, re-running the rebuild effect in an endless loop.
  it('settles when initialValues is omitted (no re-render loop)', () => {
    const onParametersChange = vi.fn();
    const { rerender } = render(
      <DynamicSchemaForm schema={schema} onParametersChange={onParametersChange} />,
    );
    rerender(<DynamicSchemaForm schema={schema} onParametersChange={onParametersChange} />);

    expect(onParametersChange.mock.calls.length).toBeLessThanOrEqual(4);
    expect(onParametersChange).toHaveBeenLastCalledWith({ name: 'demo', replicas: 2 });
  });

  it('seeds values from initialValues over schema defaults', () => {
    const onParametersChange = vi.fn();
    render(
      <DynamicSchemaForm
        schema={schema}
        initialValues={{ name: 'custom' }}
        onParametersChange={onParametersChange}
      />,
    );

    expect(onParametersChange).toHaveBeenLastCalledWith({ name: 'custom', replicas: 2 });
  });
});
