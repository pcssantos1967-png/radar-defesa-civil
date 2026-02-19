import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
          'disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-accent text-background hover:bg-accent/90 focus:ring-accent':
              variant === 'primary',
            'bg-background-tertiary text-text border border-border hover:border-border-hover focus:ring-accent':
              variant === 'secondary',
            'text-text-secondary hover:bg-background-tertiary hover:text-text focus:ring-accent':
              variant === 'ghost',
            'bg-accent-error text-white hover:bg-accent-error/90 focus:ring-accent-error':
              variant === 'danger',
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
