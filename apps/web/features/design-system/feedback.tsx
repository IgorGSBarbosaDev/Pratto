'use client';

import { AlertTriangle, RotateCcw, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

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
