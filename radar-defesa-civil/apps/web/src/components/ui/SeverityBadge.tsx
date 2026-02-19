import { clsx } from 'clsx';
import { SEVERITY_LABELS } from '@/constants/colors';

interface SeverityBadgeProps {
  severity: 'observation' | 'attention' | 'alert' | 'max_alert';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function SeverityBadge({ severity, size = 'md', showLabel = true }: SeverityBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        {
          'px-2 py-0.5 text-xs': size === 'sm',
          'px-3 py-1 text-sm': size === 'md',
          'bg-severity-observation text-white': severity === 'observation',
          'bg-severity-attention text-black': severity === 'attention',
          'bg-severity-alert text-white': severity === 'alert',
          'bg-severity-max-alert text-white animate-pulse': severity === 'max_alert',
        }
      )}
    >
      <span
        className={clsx('rounded-full', {
          'w-1.5 h-1.5': size === 'sm',
          'w-2 h-2': size === 'md',
          'bg-white': severity !== 'attention',
          'bg-black': severity === 'attention',
        })}
      />
      {showLabel && SEVERITY_LABELS[severity]}
    </span>
  );
}
