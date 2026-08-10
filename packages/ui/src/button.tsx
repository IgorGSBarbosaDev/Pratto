import type { ButtonHTMLAttributes } from 'react';

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-accent,#f45b3d)] px-4 text-sm font-medium text-white transition hover:bg-[var(--color-accent-deep,#d8452a)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${className}`}
      {...props}
    />
  );
}
