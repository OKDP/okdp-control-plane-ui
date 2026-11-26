import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstanceStatusAlert } from './instance-status-alert';

describe('InstanceStatusAlert', () => {
  it('shows nothing for a ready instance', () => {
    const { container } = render(<InstanceStatusAlert status="Ready" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the engine message on a ready instance', () => {
    render(<InstanceStatusAlert status="Ready" message="upgrade failed: invalid replicas" />);
    expect(screen.getByText('Message from the deployment engine')).toBeInTheDocument();
    expect(screen.getByText('upgrade failed: invalid replicas')).toHaveClass('mono');
    expect(screen.getByRole('status')).toHaveClass('alert-warn');
  });

  it('explains a pending instance without naming where the engine stores it', () => {
    render(<InstanceStatusAlert status="Pending" />);
    expect(
      screen.getByText('The deployment engine accepted the change and has not applied it yet.'),
    ).toBeInTheDocument();
  });

  it('keeps Unknown apart from Pending', () => {
    render(<InstanceStatusAlert status="Unknown" />);
    expect(screen.getByText('Status unknown')).toBeInTheDocument();
    expect(screen.queryByText(/has not applied it yet/)).not.toBeInTheDocument();
  });

  it('prefers the engine message over the generic text', () => {
    render(<InstanceStatusAlert status="Error" message="helm upgrade failed" />);
    expect(screen.getByText('Instance error')).toBeInTheDocument();
    expect(screen.getByText('helm upgrade failed')).toHaveClass('mono');
  });

  it('keeps the texts of the statuses the current server sends', () => {
    const { rerender } = render(<InstanceStatusAlert status="Installing" />);
    expect(
      screen.getByText('The deployment engine is installing this instance.'),
    ).toBeInTheDocument();

    rerender(<InstanceStatusAlert status="Updating" />);
    expect(
      screen.getByText('The deployment engine is rolling out the new configuration.'),
    ).toBeInTheDocument();

    rerender(<InstanceStatusAlert status="Error" />);
    const fallback = screen.getByText('Check the pod logs for the underlying error.');
    expect(fallback).toBeInTheDocument();
    expect(fallback).not.toHaveClass('mono');
  });

  it('flags a degraded instance', () => {
    render(<InstanceStatusAlert status="Degraded" />);
    expect(screen.getByRole('status')).toHaveClass('alert-warn');
  });

  it('explains a suspended or deleting instance', () => {
    const { rerender } = render(<InstanceStatusAlert status="Suspended" />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();

    rerender(<InstanceStatusAlert status="Deleting" />);
    expect(screen.getByText('The instance is being removed.')).toBeInTheDocument();
  });
});
