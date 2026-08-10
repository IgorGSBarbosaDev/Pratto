'use client';

import { AlertCircle } from 'lucide-react';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'soft' | 'ghost' | 'outline' | 'ink';
  size?: 'sm' | 'md';
};

export function Button({
  variant = 'solid',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const variants = {
    solid: 'bg-accent-deep text-white hover:bg-ink shadow-[0_8px_20px_-12px_var(--color-accent)]',
    soft: 'bg-sand text-ink hover:bg-sand-deep',
    ghost: 'text-ink hover:bg-black/5',
    outline: 'border border-line bg-transparent text-ink hover:border-ink/30 hover:bg-cream',
    ink: 'bg-ink text-white hover:bg-ink-soft',
  };
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-[15px]' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </span>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-ink">
        {label}
        {required ? <span className="text-accent-deep">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-accent-deep">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px] text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function TextInput({ invalid, className = '', ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`pratto-input ${invalid ? 'border-accent focus:border-accent' : ''} ${className}`}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`pratto-input ${invalid ? 'border-accent focus:border-accent' : ''} ${className}`}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ invalid, className = '', children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={`pratto-input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220%200%2024%2024%22 fill=%22none%22 stroke=%22%238a827a%22 stroke-width=%222%22><path d=%22M6%209l6%206%206-6%22/></svg>')] bg-[length:14px] bg-[right_0.9rem_center] bg-no-repeat pr-9 ${invalid ? 'border-accent focus:border-accent' : ''} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Toggle({
  on,
  onToggle,
  disabled,
  ariaLabel,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'bg-herb' : 'bg-sand-deep'}`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(24,23,22,0.35)] transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}
