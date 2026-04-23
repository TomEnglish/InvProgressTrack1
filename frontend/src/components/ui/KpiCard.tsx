import clsx from 'clsx';
import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  subValue?: ReactNode;
  variant?: 'default' | 'success' | 'warn' | 'danger';
}

export default function KpiCard({ label, value, subValue, variant = 'default' }: KpiCardProps) {
  const borderColors = {
    default: 'border-l-primary',
    success: 'border-l-success',
    warn: 'border-l-warn',
    danger: 'border-l-danger',
  };

  return (
    <div className={clsx('bg-surface shrink-0 flex-1 min-w-[155px] rounded-md p-3.5 shadow-sm border-l-[4px]', borderColors[variant])}>
      <div className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5 font-semibold">{label}</div>
      <div className="text-2xl font-bold text-text">{value}</div>
      {subValue && <div className="text-[11px] text-text-muted mt-px">{subValue}</div>}
    </div>
  );
}
