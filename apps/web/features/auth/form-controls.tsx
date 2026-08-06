import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
>(function Field({ label, error, id, ...props }, ref) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-200" htmlFor={id}>
      {label}
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="text-sm font-normal text-rose-300">
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/60 p-7 shadow-2xl shadow-black/30">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}

export const submitClass =
  'w-full rounded-xl bg-amber-300 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60';
