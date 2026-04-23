import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warn' | 'danger' | 'info';
}

export default function Badge({ children, variant = 'info' }: BadgeProps) {
  const styles = {
    success: 'bg-success-soft text-success-deep',
    warn: 'bg-warn-soft text-warn-deep',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
  };

  return (
    <span className={clsx('inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold', styles[variant])}>
      {children}
    </span>
  );
}
