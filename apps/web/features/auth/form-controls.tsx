import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
>(function Field({ label, error, id, ...props }, ref) {
  return (
    <label className="grid gap-2 text-[13px] font-medium text-ink" htmlFor={id}>
      {label}
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="pratto-input"
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="text-[13px] font-medium text-accent-deep">
          {error}
        </span>
      ) : null}
    </label>
  );
});

export function AuthCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sand px-5 py-12 text-ink">
      <div className="pointer-events-none absolute -left-24 top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-2xl border border-line bg-cream p-7 shadow-[0_28px_70px_-38px_rgba(24,23,22,0.42)] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
            P
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.08em] text-ink">PRATTO</p>
            <p className="text-xs text-ink-faint">{eyebrow}</p>
          </div>
        </div>
        <h1 className="font-serif text-[36px] leading-[1.05] text-ink">{title}</h1>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}

export const submitClass =
  'h-11 w-full rounded-xl bg-accent-deep px-4 font-medium text-white shadow-[0_8px_20px_-12px_var(--color-accent)] transition hover:bg-ink active:scale-[0.99] disabled:cursor-wait disabled:opacity-50';
