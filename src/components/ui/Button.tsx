'use client';

import { forwardRef } from 'react';

const variantStyles = {
  primary:
    'rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200',
  secondary:
    'rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800',
  danger:
    'rounded-md border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20',
  success:
    'rounded-md border border-emerald-400 px-4 py-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20',
} as const;

export type ButtonVariant = keyof typeof variantStyles;

export const Button = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant }
>(function Button({ className = '', variant = 'secondary', type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={`min-h-[44px] min-w-[44px] touch-manipulation ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
});
