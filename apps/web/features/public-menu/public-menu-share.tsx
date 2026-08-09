'use client';

import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import { ApiClientError } from '../auth/api-client';
import { establishmentApi } from '../establishments/api-client';

import { buildPublicMenuUrl } from './public-url';

interface PublicMenuShareProps {
  establishmentId: string;
  publicMenuBaseUrl: string;
}

interface GeneratedQr {
  png: string;
  svg: string;
}

export function PublicMenuShare({ establishmentId, publicMenuBaseUrl }: PublicMenuShareProps) {
  const settingsQuery = useQuery({
    queryKey: ['public-menu-share-settings', establishmentId],
    queryFn: () => establishmentApi.get(establishmentId),
  });
  const [qr, setQr] = useState<GeneratedQr | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const publicUrl = settingsQuery.data
    ? buildPublicMenuUrl(publicMenuBaseUrl, settingsQuery.data.publicId, settingsQuery.data.slug)
    : null;

  useEffect(() => {
    if (!publicUrl) {
      setQr(null);
      setQrError(null);
      return;
    }

    let cancelled = false;
    setQr(null);
    setQrError(null);
    void Promise.all([
      QRCode.toDataURL(publicUrl, {
        errorCorrectionLevel: 'M',
        width: 768,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffffff' },
      }),
      QRCode.toString(publicUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        width: 768,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffffff' },
      }),
    ])
      .then(([png, svg]) => {
        if (cancelled) return;
        setQr({
          png,
          svg: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        });
      })
      .catch(() => {
        if (!cancelled) setQrError('Não foi possível gerar o QR Code agora.');
      });

    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  async function sharePublicMenu() {
    if (!publicUrl || !settingsQuery.data) return;
    setFeedback(null);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Cardápio de ${settingsQuery.data.name}`,
          text: `Confira o cardápio de ${settingsQuery.data.name}.`,
          url: publicUrl,
        });
        setFeedback('Link compartilhado.');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    const copied = await copyText(publicUrl);
    setFeedback(
      copied ? 'Link copiado para a área de transferência.' : 'Não foi possível copiar o link.',
    );
  }

  if (settingsQuery.isPending) {
    return (
      <section
        aria-labelledby="public-menu-share-title"
        className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5"
      >
        <h3 id="public-menu-share-title" className="text-lg font-semibold">
          QR Code do cardápio
        </h3>
        <div role="status" aria-label="Carregando link público" className="mt-4 space-y-3">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-800" />
          <div className="h-10 animate-pulse rounded bg-slate-800" />
        </div>
      </section>
    );
  }

  if (settingsQuery.error || !settingsQuery.data || !publicUrl) {
    return (
      <section
        aria-labelledby="public-menu-share-title"
        className="mt-6 rounded-2xl border border-rose-900/70 bg-rose-950/30 p-5"
      >
        <h3 id="public-menu-share-title" className="text-lg font-semibold text-white">
          QR Code do cardápio
        </h3>
        <p role="alert" className="mt-3 text-sm text-rose-200">
          {messageFor(settingsQuery.error)}
        </p>
        <button
          className="mt-4 rounded-lg border border-rose-800 px-3 py-2 text-sm text-rose-100 hover:border-rose-500"
          type="button"
          onClick={() => void settingsQuery.refetch()}
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="public-menu-share-title"
      className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Publicação ativa
        </p>
        <h3 id="public-menu-share-title" className="mt-2 text-lg font-semibold">
          QR Code do cardápio
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Imprima ou compartilhe este acesso público com os visitantes.
        </p>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[12rem_1fr] md:items-center">
        <div className="rounded-xl bg-white p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="h-full w-full"
              src={qr.png}
              alt={`QR Code para o cardápio de ${settingsQuery.data.name}`}
              width={768}
              height={768}
            />
          ) : (
            <div
              role="status"
              aria-label="Gerando QR Code"
              className="aspect-square animate-pulse bg-slate-200"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Link público
          </p>
          <a
            className="mt-2 block break-all text-sm text-emerald-300 underline underline-offset-4 hover:text-emerald-200"
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
          >
            {publicUrl}
          </a>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!qr}
              onClick={() => void sharePublicMenu()}
            >
              Compartilhar link
            </button>
            {qr && (
              <>
                <a
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                  href={qr.png}
                  download={`${settingsQuery.data.slug}-cardapio-qr.png`}
                >
                  Baixar PNG
                </a>
                <a
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                  href={qr.svg}
                  download={`${settingsQuery.data.slug}-cardapio-qr.svg`}
                >
                  Baixar SVG
                </a>
              </>
            )}
          </div>
          {qrError ? (
            <p role="alert" className="mt-3 text-sm text-rose-300">
              {qrError}
            </p>
          ) : null}
          {feedback ? (
            <p role="status" aria-live="polite" className="mt-3 text-sm text-emerald-300">
              {feedback}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível carregar o link público.';
}

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the legacy browser API.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}
