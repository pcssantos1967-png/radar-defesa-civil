import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={clsx(
          'w-full bg-background-tertiary border border-border rounded-md px-3 py-2',
          'text-text placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
          'transition-colors duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
