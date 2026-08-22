'use client';

import type { PublicMenuProductResponse } from '@pratto/contracts';
import { Check, Copy, Instagram, MessageCircle, Send, Twitter, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { IconButton } from '../design-system/primitives';
import { useModalDialog } from '../design-system/use-modal-dialog';

import { buildPublicProductUrl } from './public-url';

export interface ShareFeedback {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

export function ProductShareButton({
  productName,
  onClick,
}: {
  productName: string;
  onClick: () => void;
}) {
  return (
    <IconButton
      type="button"
      aria-label={`Compartilhar ${productName}`}
      aria-haspopup="dialog"
      onClick={onClick}
      className="!h-11 !w-11 shrink-0 border border-white/30 bg-black/[0.42] text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,.75)] backdrop-blur-md hover:bg-black/[0.58]"
    >
      <Send size={19} strokeWidth={1.9} aria-hidden="true" className="-translate-x-px" />
    </IconButton>
  );
}

export function ProductShareSheet({
  publicId,
  slug,
  establishmentName,
  product,
  lightTheme,
  onClose,
  onFeedback,
}: {
  publicId: string;
  slug: string;
  establishmentName: string;
  product: PublicMenuProductResponse;
  lightTheme: boolean;
  onClose: () => void;
  onFeedback: (message: string, tone: ShareFeedback['tone']) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  const [copyError, setCopyError] = useState<string>();
  const productUrl = buildPublicProductUrl(window.location.origin, publicId, slug, product.id);
  const shareText = `${product.name} no ${establishmentName}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${productUrl}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({
    text: shareText,
    url: productUrl,
  }).toString()}`;

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 220);
  }, [closing, onClose]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  useModalDialog(true, dialogRef, requestClose);

  const copyProductLink = useCallback(
    async (instagramFallback = false) => {
      const copied = await copyText(productUrl);
      if (!copied) {
        const message = 'Não foi possível copiar o link. Tente novamente.';
        setCopyError(message);
        return;
      }

      setCopyError(undefined);
      onFeedback(
        instagramFallback ? 'Link copiado — cole no Instagram.' : 'Link do prato copiado.',
        'success',
      );
      requestClose();
    },
    [onFeedback, productUrl, requestClose],
  );

  const shareToInstagram = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareText, text: shareText, url: productUrl });
        requestClose();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    await copyProductLink(true);
  };

  return (
    <div className="absolute inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Fechar compartilhamento"
        className={`absolute inset-0 bg-black/[0.48] backdrop-blur-[2px] ${
          closing
            ? 'animate-[pratto-overlay-out_220ms_ease-in_both]'
            : 'animate-[pratto-overlay-in_300ms_ease-out_both]'
        }`}
        onClick={requestClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-share-title"
        aria-describedby="product-share-description"
        className={`absolute inset-x-0 bottom-0 rounded-t-[24px] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_48px_-28px_rgba(0,0,0,.65)] ${
          lightTheme ? 'bg-cream text-ink' : 'bg-ink text-white'
        } ${
          closing
            ? 'animate-[pratto-sheet-out_220ms_ease-in_both]'
            : 'animate-[pratto-sheet-in_300ms_cubic-bezier(0.16,1,0.3,1)_both]'
        }`}
      >
        <div
          aria-hidden="true"
          className={`mx-auto h-1 w-10 rounded-full ${lightTheme ? 'bg-ink/20' : 'bg-white/25'}`}
        />
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="product-share-title" className="font-serif text-[24px] leading-tight">
              Compartilhar prato
            </h2>
            <p
              id="product-share-description"
              className={`mt-1 truncate text-sm ${lightTheme ? 'text-ink-faint' : 'text-white/60'}`}
            >
              {product.name}
            </p>
          </div>
          <IconButton
            type="button"
            aria-label="Fechar"
            data-dialog-initial-focus
            onClick={requestClose}
            className={
              lightTheme ? 'bg-sand text-ink hover:bg-sand-deep' : 'bg-white/10 text-white'
            }
          >
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2" aria-label="Opções de compartilhamento">
          <ShareAction
            label="Copiar link"
            lightTheme={lightTheme}
            icon={<Copy size={20} aria-hidden="true" />}
            onClick={() => void copyProductLink()}
          />
          <ShareAction
            label="WhatsApp"
            lightTheme={lightTheme}
            icon={<MessageCircle size={20} aria-hidden="true" />}
            href={whatsappUrl}
            onClick={requestClose}
          />
          <ShareAction
            label="Instagram"
            lightTheme={lightTheme}
            icon={<Instagram size={20} aria-hidden="true" />}
            onClick={() => void shareToInstagram()}
          />
          <ShareAction
            label="Twitter / X"
            lightTheme={lightTheme}
            icon={<Twitter size={20} aria-hidden="true" />}
            href={twitterUrl}
            onClick={requestClose}
          />
        </div>

        {copyError ? (
          <p role="alert" className="mt-3 text-sm font-medium text-accent">
            {copyError}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function ProductShareToast({
  feedback,
  onDismiss,
}: {
  feedback: ShareFeedback;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 2_400);
    return () => window.clearTimeout(timer);
  }, [feedback.id, onDismiss]);

  return (
    <div
      role={feedback.tone === 'error' ? 'alert' : 'status'}
      aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
      className={`absolute bottom-[92px] left-4 right-4 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-[0_12px_30px_-12px_rgba(24,23,22,.5)] animate-[pratto-toast-in_220ms_ease-out_both] ${
        feedback.tone === 'success' ? 'bg-cream text-ink' : 'bg-ink text-white'
      }`}
    >
      {feedback.tone === 'success' ? (
        <Check size={17} className="shrink-0 text-herb" aria-hidden="true" />
      ) : (
        <X size={17} className="shrink-0 text-accent" aria-hidden="true" />
      )}
      {feedback.message}
    </div>
  );
}

function ShareAction({
  label,
  icon,
  lightTheme,
  href,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  lightTheme: boolean;
  href?: string;
  onClick: () => void;
}) {
  const className = `group flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-1.5 text-center transition-all duration-150 active:scale-95 ${
    lightTheme ? 'text-ink-soft hover:bg-sand' : 'text-white/75 hover:bg-white/[0.08]'
  }`;
  const content = (
    <>
      <span
        className={`grid h-12 w-12 place-items-center rounded-full transition-colors ${
          lightTheme
            ? 'bg-sand text-ink group-hover:bg-sand-deep'
            : 'bg-white/[0.1] text-white group-hover:bg-white/[0.16]'
        }`}
      >
        {icon}
      </span>
      <span className="min-h-8 text-[11px] font-medium leading-4">{label}</span>
    </>
  );

  return href ? (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      {content}
    </a>
  ) : (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Continue with the browser's legacy copy path.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  if (typeof document.execCommand !== 'function') {
    textarea.remove();
    return false;
  }
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}
