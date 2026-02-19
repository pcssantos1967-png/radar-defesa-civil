import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils';
import { SeverityBadge } from './SeverityBadge';

describe('SeverityBadge', () => {
  it('renders observation severity', () => {
    render(<SeverityBadge severity="observation" />);
    expect(screen.getByText('Observação')).toBeInTheDocument();
  });

  it('renders attention severity', () => {
    render(<SeverityBadge severity="attention" />);
    expect(screen.getByText('Atenção')).toBeInTheDocument();
  });

  it('renders alert severity', () => {
    render(<SeverityBadge severity="alert" />);
    expect(screen.getByText('Alerta')).toBeInTheDocument();
  });

  it('renders max_alert severity', () => {
    render(<SeverityBadge severity="max_alert" />);
    expect(screen.getByText('Alerta Máximo')).toBeInTheDocument();
  });

  it('applies correct color for observation', () => {
    render(<SeverityBadge severity="observation" />);
    const badge = screen.getByText('Observação').closest('span');
    expect(badge).toHaveClass('bg-severity-observation');
  });

  it('applies correct color for max_alert', () => {
    render(<SeverityBadge severity="max_alert" />);
    const badge = screen.getByText('Alerta Máximo').closest('span');
    expect(badge).toHaveClass('bg-severity-max_alert');
  });

  it('applies small size when size="sm"', () => {
    render(<SeverityBadge severity="alert" size="sm" />);
    const badge = screen.getByText('Alerta').closest('span');
    expect(badge).toHaveClass('text-xs');
  });
});
