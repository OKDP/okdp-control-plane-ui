import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  // Regression: fields hidden by x-ui-condition were still validated (an
  // invisible error blocked submission) and their stale values were emitted.
  it('skips hidden conditional fields in validation and emission', () => {
    const onParametersChange = vi.fn();
    const onValidityChange = vi.fn();
    render(
      <DynamicSchemaForm
        schema={{
          properties: {
            mode: { type: 'string', enum: ['on', 'off'], default: 'off' },
            extraMemory: {
              type: 'string',
              default: '',
              'x-ui-condition': { field: 'mode', value: 'on' },
            },
          },
        }}
        initialValues={{ extraMemory: 'not-a-quantity' }}
        onParametersChange={onParametersChange}
        onValidityChange={onValidityChange}
      />,
    );

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
    expect(onParametersChange).toHaveBeenLastCalledWith({ mode: 'off' });
  });

  // Regression: an enum field matching the quantity heuristic ("rateLimitPolicy")
  // failed K8S_QUANTITY_RE on its enum values and invisibly invalidated the form.
  it('does not quantity-validate enum (select) fields', () => {
    const onValidityChange = vi.fn();
    render(
      <DynamicSchemaForm
        schema={{
          properties: {
            rateLimitPolicy: { type: 'string', enum: ['burst', 'steady'], default: 'burst' },
          },
        }}
        onParametersChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  // Regression: the error message only rendered for the plain-text widget, and
  // the camelCase haystack never matched \bmemory\b ("driverMemory").
  it('renders the quantity error for non-text widgets and camelCase names', () => {
    const onValidityChange = vi.fn();
    render(
      <DynamicSchemaForm
        schema={{
          properties: {
            driverMemory: { type: 'string', default: 'bogus', 'x-ui-widget': 'textarea' },
          },
        }}
        onParametersChange={vi.fn()}
        onValidityChange={onValidityChange}
      />,
    );

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByText(/Invalid Kubernetes quantity/)).toBeTruthy();
  });
});

// An object whose keys the schema declares is edited as typed fields, one per
// property, so a boolean stays a boolean and an integer stays an integer.
// Rendering it as a free-form key/value editor turned "enabled: true" into the
// string "true" and failed the deployment's schema validation (#100), and gave
// no typed editing for its declared keys (#107).
describe('typed object parameters', () => {
  const objSchema = {
    properties: {
      dagsGitSync: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: false },
          depth: { type: 'integer', default: 1 },
          repo: { type: 'string', default: '' },
        },
      },
    },
  };

  it('renders a typed control per declared property, not a JSON blob', () => {
    render(<DynamicSchemaForm schema={objSchema} onParametersChange={vi.fn()} />);
    // A switch for the boolean and a text box for the string — not one textarea
    // holding the whole object as JSON.
    expect(screen.getByRole('switch')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('keeps a boolean a boolean when toggled', () => {
    const onParametersChange = vi.fn();
    render(<DynamicSchemaForm schema={objSchema} onParametersChange={onParametersChange} />);

    fireEvent.click(screen.getByRole('switch'));

    const last = onParametersChange.mock.calls.at(-1)![0];
    expect(last.dagsGitSync.enabled).toBe(true);
  });

  it('preserves declared types instead of stringifying them', () => {
    const onParametersChange = vi.fn();
    render(
      <DynamicSchemaForm
        schema={objSchema}
        initialValues={{ dagsGitSync: { enabled: true, depth: 3, repo: 'x' } }}
        onParametersChange={onParametersChange}
      />,
    );

    const last = onParametersChange.mock.calls.at(-1)![0];
    expect(last.dagsGitSync).toEqual({ enabled: true, depth: 3, repo: 'x' });
    expect(typeof last.dagsGitSync.enabled).toBe('boolean');
    expect(typeof last.dagsGitSync.depth).toBe('number');
  });

  // Regression (#103): a nested object property (a realm's
  // rootPrincipal.credentialsSecret.name) was unreachable — the editor only
  // exposed the top-level keys and froze the rest as [object Object].
  it('reaches a nested object property', () => {
    const onParametersChange = vi.fn();
    const nested = {
      properties: {
        realm: {
          type: 'object',
          properties: {
            name: { type: 'string', default: '' },
            rootPrincipal: {
              type: 'object',
              properties: {
                credentialsSecret: {
                  type: 'object',
                  properties: { name: { type: 'string', default: '' } },
                },
              },
            },
          },
        },
      },
    };
    render(
      <DynamicSchemaForm
        schema={nested}
        initialValues={{ realm: { rootPrincipal: { credentialsSecret: { name: 'seed' } } } }}
        onParametersChange={onParametersChange}
      />,
    );

    const last = onParametersChange.mock.calls.at(-1)![0];
    expect(last.realm.rootPrincipal.credentialsSecret.name).toBe('seed');
    // The realm name and the nested credentials-secret name are both editable.
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(2);
  });
});

// A list of objects the schema shapes is edited one typed column per property,
// so a boolean column stays a boolean instead of the string a text field emits.
describe('typed object-list columns', () => {
  const listSchema = {
    properties: {
      syncs: {
        type: 'array',
        items: {
          properties: {
            enabled: { type: 'boolean', default: false },
            repo: { type: 'string', default: '' },
          },
        },
        default: [{ enabled: false, repo: '' }],
      },
    },
  };

  it('renders a switch for a boolean column instead of a text field', () => {
    render(<DynamicSchemaForm schema={listSchema} onParametersChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('keeps a toggled column boolean', () => {
    const onParametersChange = vi.fn();
    render(<DynamicSchemaForm schema={listSchema} onParametersChange={onParametersChange} />);

    fireEvent.click(screen.getByRole('switch'));

    const last = onParametersChange.mock.calls.at(-1)![0];
    expect(last.syncs[0].enabled).toBe(true);
  });
});

// A row being typed is not yet a valid map entry: it may have no key, or a key
// that duplicates another until the typing is finished. Deriving the rows from
// the emitted object made two fresh rows share the empty key and collapse.
describe('the key-value widget', () => {
  const mapping = { properties: { roleMapping: { type: 'object', properties: {} } } };

  it('keeps two fresh rows apart', () => {
    render(<DynamicSchemaForm schema={mapping} onParametersChange={vi.fn()} />);

    const add = screen.getByRole('button', { name: /Add an entry/ });
    fireEvent.click(add);
    fireEvent.click(add);

    expect(screen.getAllByPlaceholderText('OIDC role')).toHaveLength(2);
  });

  it('emits only the rows that carry a key', () => {
    const onParametersChange = vi.fn();
    render(<DynamicSchemaForm schema={mapping} onParametersChange={onParametersChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Add an entry/ }));
    fireEvent.change(screen.getAllByPlaceholderText('OIDC role')[0], {
      target: { value: 'data-team' },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/granted roles/)[0], {
      target: { value: 'reader' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add an entry/ }));

    const last = onParametersChange.mock.calls.at(-1)![0];
    expect(last.roleMapping).toEqual({ 'data-team': 'reader' });
  });
});
