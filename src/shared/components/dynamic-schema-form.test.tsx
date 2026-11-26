import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DynamicSchemaForm } from './dynamic-schema-form';
import { connectionApi } from '../../core/api/connection-api';

vi.mock('../../core/api/connection-api', () => ({
  connectionApi: { selectable: vi.fn() },
}));

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

// Every column of an object list used to be a text box, so a list or a number
// reached the package as a string and failed its schema ("got string, want
// array"): a list of users, each with its allowed actions and topics.
describe('the object-list widget', () => {
  const users = {
    properties: {
      saslUsers: {
        type: 'array',
        items: {
          properties: {
            username: { type: 'string' },
            actions: { type: 'array', items: { type: 'string', enum: ['read', 'write', 'admin'] } },
            topics: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      topics: {
        type: 'array',
        items: {
          properties: {
            name: { type: 'string' },
            partitions: { type: 'integer', default: 1 },
            replicationFactor: { type: 'integer', default: 1 },
          },
        },
      },
    },
  };

  it('turns the values typed into a list column into a list', () => {
    const onParametersChange = vi.fn();
    render(
      <DynamicSchemaForm
        schema={users}
        initialValues={{ saslUsers: [{ username: 'producer' }] }}
        onParametersChange={onParametersChange}
      />,
    );

    const input = screen.getByPlaceholderText('Type and press Enter');
    fireEvent.change(input, { target: { value: 'events' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    const last = onParametersChange.mock.calls.at(-1)![0];
    expect(last.saslUsers[0].topics).toEqual(['events']);
  });

  it('keeps an enum list column a list, not a text box', () => {
    const onParametersChange = vi.fn();
    render(
      <DynamicSchemaForm
        schema={users}
        initialValues={{ saslUsers: [{ username: 'producer', actions: ['write'] }] }}
        onParametersChange={onParametersChange}
      />,
    );

    // The only element holding the value is the multi-select's read-only
    // combobox, not an editable text box.
    const holder = screen.getByDisplayValue('write');
    expect(holder.getAttribute('role')).toBe('combobox');
    expect(holder.hasAttribute('readonly')).toBe(true);
    const last = onParametersChange.mock.calls.at(-1)![0];
    expect(last.saslUsers[0].actions).toEqual(['write']);
  });

  it('renders integer columns as number inputs', () => {
    render(
      <DynamicSchemaForm
        schema={users}
        initialValues={{ topics: [{ name: 'events', partitions: 3 }] }}
        onParametersChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
    expect(screen.queryByDisplayValue('events')).toBeTruthy();
  });
});

// A free-form map whose values keep the type they are typed as, so a boolean
// reaches the chart as a boolean and a number as a number, without freezing the
// keys or their types.
describe('the key-value-scalar widget', () => {
  const gitSync = {
    properties: {
      dagsGitSync: {
        type: 'object',
        additionalProperties: true,
        'x-ui-widget': 'key-value-scalar',
        title: 'Git sync',
      },
    },
  };

  it('offers a free-form key/value editor, no frozen options', () => {
    render(<DynamicSchemaForm schema={gitSync} onParametersChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add parameter/ })).toBeTruthy();
  });

  it.each([
    ['true', true],
    ['false', false],
    ['42', 42],
    ['1.5', 1.5],
    ['60s', '60s'],
    ['"true"', 'true'],
  ])('parses the typed value %s by its syntax', (typed, expected) => {
    const onParametersChange = vi.fn();
    render(<DynamicSchemaForm schema={gitSync} onParametersChange={onParametersChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Add parameter/ }));
    fireEvent.change(screen.getByPlaceholderText('parameter'), { target: { value: 'k' } });
    fireEvent.change(screen.getByPlaceholderText(/true, 42/), { target: { value: typed } });

    const last = onParametersChange.mock.calls.at(-1)![0];
    expect(last.dagsGitSync).toEqual({ k: expected });
  });
});

// A column carrying a connection marker offers the project's connections of
// that contract. Both marker dialects are read.
describe('connection markers in an object list', () => {
  const selectable = vi.mocked(connectionApi.selectable);

  function catalogs(column: Record<string, unknown>) {
    return {
      properties: {
        catalogs: {
          type: 'array',
          items: { properties: { name: { type: 'string' }, connection: column } },
        },
      },
    };
  }

  function renderWith(column: Record<string, unknown>) {
    selectable.mockReset();
    selectable.mockResolvedValue([]);
    render(
      <DynamicSchemaForm
        schema={catalogs(column)}
        projectId="team-a"
        initialValues={{ catalogs: [{ name: 'lake' }] }}
        onParametersChange={vi.fn()}
      />,
    );
  }

  it.each([
    ['x-okdp-connection-ref', { 'x-okdp-connection-ref': { contract: 'polaris' } }],
    ['x-kubocd-connection-ref', { 'x-kubocd-connection-ref': { contract: 'polaris' } }],
  ])('offers the connections named by %s', (_marker, marker) => {
    renderWith({ type: 'string', ...marker });

    expect(selectable).toHaveBeenCalledWith('team-a', 'polaris');
    expect(screen.getAllByText('Select a polaris connection').length).toBeGreaterThan(0);
  });

  it('prefers the neutral marker when both are set', () => {
    renderWith({
      type: 'string',
      'x-okdp-connection-ref': { contract: 'polaris' },
      'x-kubocd-connection-ref': { contract: 'hive-metastore' },
    });

    expect(selectable).toHaveBeenCalledTimes(1);
    expect(selectable).toHaveBeenCalledWith('team-a', 'polaris');
  });

  it('keeps a free-text cell without a marker', () => {
    renderWith({ type: 'string' });

    expect(selectable).not.toHaveBeenCalled();
    expect(screen.queryByText(/Select a .* connection/)).toBeNull();
  });

  it.each(['toString', 'constructor'])(
    'does not look up Object.prototype when a contract is named %s',
    (contract) => {
      selectable.mockReset();
      selectable.mockReturnValue(new Promise(() => undefined));
      render(
        <DynamicSchemaForm
          schema={catalogs({ type: 'string', 'x-okdp-connection-ref': { contract } })}
          projectId="team-a"
          initialValues={{ catalogs: [{ name: 'lake' }] }}
          onParametersChange={vi.fn()}
        />,
      );

      expect(screen.getAllByText(`Select a ${contract} connection`).length).toBeGreaterThan(0);
    },
  );
});
