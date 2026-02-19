import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/utils';
import { AlertTrendChart } from './AlertTrendChart';

// Mock Recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('AlertTrendChart', () => {
  const mockData = [
    {
      period: '2024-01-01T00:00:00Z',
      observation: 5,
      attention: 3,
      alert: 2,
      max_alert: 1,
      total: 11,
    },
    {
      period: '2024-01-02T00:00:00Z',
      observation: 6,
      attention: 4,
      alert: 3,
      max_alert: 0,
      total: 13,
    },
  ];

  it('renders the chart container', () => {
    render(<AlertTrendChart data={mockData} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders area chart', () => {
    render(<AlertTrendChart data={mockData} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('renders chart components', () => {
    render(<AlertTrendChart data={mockData} />);
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('renders with different intervals', () => {
    const { rerender } = render(<AlertTrendChart data={mockData} interval="hour" />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();

    rerender(<AlertTrendChart data={mockData} interval="week" />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();

    rerender(<AlertTrendChart data={mockData} interval="month" />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('renders with showTotal option', () => {
    render(<AlertTrendChart data={mockData} showTotal />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('handles empty data', () => {
    render(<AlertTrendChart data={[]} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });
});
