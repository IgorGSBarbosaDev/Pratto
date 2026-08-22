'use client';

import { AlertTriangle, RotateCcw, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useRef, useState, useId, type ReactNode } from 'react';

import { Button } from './primitives';
import { useModalDialog } from './use-modal-dialog';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function EmptyState({
  icon: Icon = UtensilsCrossed,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-2 py-10' : 'gap-3 py-16'}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sand text-ink-soft">
        <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
      </div>
      <div>
        <p className="text-[16px] font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-xs text-sm leading-snug text-ink-faint">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Algo deu errado',
  description = 'Não foi possível carregar as informações.',
  onRetry,
  dark = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${dark ? 'bg-white/15 text-white' : 'bg-accent/10 text-accent-deep'}`}
      >
        <AlertTriangle size={22} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div>
        <p className={`text-[16px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}>{title}</p>
        <p className={`mt-1 text-sm ${dark ? 'text-white/75' : 'text-ink-faint'}`}>{description}</p>
      </div>
      {onRetry ? (
        <button
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-accent-deep px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ink active:scale-[0.98]"
          onClick={onRetry}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const requestClose = () => {
    if (!pending) onCancel();
  };
  useModalDialog(open, dialogRef, requestClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Cancelar confirmação"
        onClick={requestClose}
        disabled={pending}
        className="absolute inset-0 bg-ink/45 disabled:cursor-not-allowed"
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-sm rounded-2xl bg-cream p-6 shadow-2xl"
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-deep">
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <h3 id={titleId} className="text-[18px] font-semibold text-ink">
          {title}
        </h3>
        <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
        {error ? (
          <p role="alert" className="mt-3 pratto-error">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={requestClose} disabled={pending}>
            Cancelar
          </Button>
          <Button data-dialog-initial-focus onClick={onConfirm} disabled={pending}>
            {pending ? 'Processando…' : confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function FoodImage({
  src,
  alt,
  className = '',
  imgClassName = '',
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      {state === 'loading' ? <div className="skeleton absolute inset-0" /> : null}
      {state === 'error' ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-sand-deep text-ink-faint">
          <UtensilsCrossed size={26} strokeWidth={1.5} aria-hidden="true" />
          <span className="text-xs font-medium">Imagem indisponível</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          draggable={false}
          className={`h-full w-full object-cover transition-opacity duration-500 ${state === 'ok' ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        />
      )}
    </div>
  );
}
