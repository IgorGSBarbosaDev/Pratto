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
  preview?: boolean;
}

interface GeneratedQr {
  png: string;
  svg: string;
}

export function PublicMenuShare({
  establishmentId,
  publicMenuBaseUrl,
  preview = false,
}: PublicMenuShareProps) {
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
        color: { dark: '#181716', light: '#fff9f4ff' },
      }),
      QRCode.toString(publicUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        width: 768,
        margin: 2,
        color: { dark: '#181716', light: '#fff9f4ff' },
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
      <section aria-labelledby="public-menu-share-title" className="pratto-panel p-5">
        <h3 id="public-menu-share-title" className="text-lg font-semibold">
          QR Code do cardápio
        </h3>
        <div role="status" aria-label="Carregando link público" className="mt-4 space-y-3">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-10 rounded" />
        </div>
      </section>
    );
  }

  if (settingsQuery.error || !settingsQuery.data || !publicUrl) {
    return (
      <section
        aria-labelledby="public-menu-share-title"
        className="rounded-2xl border border-accent/25 bg-accent/5 p-5"
      >
        <h3 id="public-menu-share-title" className="text-lg font-semibold text-ink">
          QR Code do cardápio
        </h3>
        <p role="alert" className="mt-3 pratto-error">
          {messageFor(settingsQuery.error)}
        </p>
        <button
          className="mt-4 rounded-xl border border-accent/30 px-3 py-2 text-sm text-accent-deep hover:border-accent"
          type="button"
          onClick={() => void settingsQuery.refetch()}
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="public-menu-share-title" className="pratto-panel p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">
          Publicação ativa
        </p>
        <h3 id="public-menu-share-title" className="mt-2 text-lg font-semibold">
          QR Code do cardápio
        </h3>
        <p className="mt-1 text-sm text-ink-faint">
          Imprima ou compartilhe este acesso público com os visitantes.
        </p>
      </div>

      {preview ? (
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[400px_1fr]">
          <div className="mx-auto rounded-[44px] border-[10px] border-ink bg-ink shadow-[0_30px_60px_-24px_rgba(24,23,22,0.5)]">
            <iframe
              className="h-[720px] w-[350px] rounded-[34px] bg-cream"
              src={publicUrl}
              title={`Prévia do cardápio de ${settingsQuery.data.name}`}
            />
          </div>
          <div className="pt-4">
            <h4 className="font-serif text-[28px] leading-tight text-ink">
              Exatamente como o cliente vê
            </h4>
            <p className="mt-3 max-w-md text-[15px] leading-7 text-ink-soft">
              A prévia usa a rota pública real e a publicação ativa. Alterações no rascunho aparecem
              somente depois de publicar uma nova versão.
            </p>
            <a
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-ink px-4 text-sm font-medium text-white"
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir cardápio em nova guia
            </a>
          </div>
        </div>
      ) : (
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
              <div role="status" aria-label="Gerando QR Code" className="skeleton aspect-square" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Link público
            </p>
            <a
              className="mt-2 block break-all text-sm text-accent-deep underline underline-offset-4 hover:text-accent"
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              {publicUrl}
            </a>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-accent-deep px-3 py-2 text-sm font-medium text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!qr}
                onClick={() => void sharePublicMenu()}
              >
                Compartilhar link
              </button>
              {qr && (
                <>
                  <a
                    className="rounded-xl border border-line px-3 py-2 text-sm text-ink-soft hover:border-ink/30"
                    href={qr.png}
                    download={`${settingsQuery.data.slug}-cardapio-qr.png`}
                  >
                    Baixar PNG
                  </a>
                  <a
                    className="rounded-xl border border-line px-3 py-2 text-sm text-ink-soft hover:border-ink/30"
                    href={qr.svg}
                    download={`${settingsQuery.data.slug}-cardapio-qr.svg`}
                  >
                    Baixar SVG
                  </a>
                </>
              )}
            </div>
            {qrError ? (
              <p role="alert" className="mt-3 pratto-error">
                {qrError}
              </p>
            ) : null}
            {feedback ? (
              <p role="status" aria-live="polite" className="mt-3 text-sm text-herb">
                {feedback}
              </p>
            ) : null}
          </div>
        </div>
      )}
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
