import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import KpiCard from './KpiCard';

describe('KpiCard UI Component', () => {
  it('mounts the component and displays text variables correctly', () => {
    render(<KpiCard label="Overall Progress" value="10%" />);
    expect(screen.getByText('Overall Progress')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('should fallback to default primary styles when no variant is passed', () => {
    const { container } = render(<KpiCard label="Cost" value="$12K" />);
    expect(container.firstChild).toHaveClass('border-l-primary');
  });

  it('renders danger variants with correct CSS markers', () => {
    const { container } = render(<KpiCard label="SPI" value="0.5" variant="danger" />);
    expect(container.firstChild).toHaveClass('border-l-danger');
  });

  it('displays the optional subValue data correctly', () => {
    render(<KpiCard label="SPI" value="0.5" subValue="Project is critically delayed" />);
    expect(screen.getByText('Project is critically delayed')).toBeInTheDocument();
  });
});
