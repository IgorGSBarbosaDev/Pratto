'use client';

import type { MenuPublicationSummaryResponse } from '@pratto/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiClientError } from '../auth/api-client';
import { EmptyState, ErrorState, Skeleton } from '../design-system/feedback';
import { Button, SectionLabel } from '../design-system/primitives';
import { PublicMenuShare } from '../public-menu/public-menu-share';

import { catalogApi } from './api-client';

const inputClass = 'pratto-input mt-1';

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível concluir a solicitação.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `publication-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PublicationManagement({
  establishmentId,
  publicMenuBaseUrl,
  selectedMenuId,
  previewOnly = false,
}: {
  establishmentId: string;
  publicMenuBaseUrl: string;
  selectedMenuId?: string | null;
  previewOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [internalMenuId, setInternalMenuId] = useState<string | null>(null);
  const menuId = selectedMenuId === undefined ? internalMenuId : selectedMenuId;
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const menusQuery = useQuery({
    queryKey: ['publication-menus', establishmentId],
    queryFn: () => catalogApi.listMenusForEstablishment(establishmentId),
  });
  const activeQueryKey = ['active-publication', establishmentId, menuId ?? 'none'] as const;
  const historyQueryKey = ['publication-history', establishmentId, menuId ?? 'none'] as const;
  const activeQuery = useQuery({
    queryKey: activeQueryKey,
    queryFn: () => catalogApi.getActivePublication(menuId!),
    enabled: menuId !== null,
  });
  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    queryFn: () => catalogApi.listPublicationHistory(menuId!),
    enabled: menuId !== null,
  });

  useEffect(() => {
    if (!menuId || !menusQuery.data) return;
    if (!menusQuery.data.menus.some((menu) => menu.id === menuId)) {
      if (selectedMenuId === undefined) setInternalMenuId(null);
      setFeedback(null);
    }
  }, [menuId, menusQuery.data, selectedMenuId]);

  const publish = useMutation({
    mutationFn: () => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return catalogApi.publishMenu(menuId, createIdempotencyKey());
    },
    onSuccess: async (publication) => {
      setFeedback({
        type: 'success',
        message: `Cardápio publicado com sucesso na versão ${publication.version}.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: activeQueryKey }),
        queryClient.invalidateQueries({ queryKey: historyQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['publication-menus', establishmentId] }),
      ]);
    },
    onError: (error) => setFeedback({ type: 'error', message: messageFor(error) }),
  });

  if (menusQuery.isPending) {
    return (
      <div role="status" className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }
  if (menusQuery.error || !menusQuery.data) {
    return (
      <ErrorState
        description={messageFor(menusQuery.error)}
        onRetry={() => void menusQuery.refetch()}
      />
    );
  }

  const publication = activeQuery.data?.publication ?? null;
  const hasUnpublishedChanges = activeQuery.data?.hasUnpublishedChanges ?? false;
  const history = historyQuery.data?.publications ?? [];
  const publicationError = activeQuery.error ?? historyQuery.error;
  const isLoadingPublication = menuId !== null && (activeQuery.isPending || historyQuery.isPending);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="mb-6">
        <SectionLabel>
          {previewOnly ? 'Exatamente como o cliente vê' : 'Snapshots imutáveis'}
        </SectionLabel>
        <h1 className="mt-1 pratto-page-title">{previewOnly ? 'Prévia mobile' : 'Publicação'}</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-ink-faint">
          {previewOnly
            ? 'Confira a publicação ativa usando a mesma rota pública dos visitantes.'
            : 'Publique uma nova versão, compartilhe o acesso e consulte o histórico preservado.'}
        </p>
      </header>
      {selectedMenuId === undefined ? (
        <section className="pratto-panel p-5">
          <label className="pratto-label" htmlFor="publication-menu-target">
            Menu para publicar
            <select
              id="publication-menu-target"
              className={inputClass}
              value={menuId ?? ''}
              onChange={(event) => {
                setInternalMenuId(event.target.value || null);
                setFeedback(null);
              }}
            >
              <option value="">Selecione um menu</option>
              {menusQuery.data.menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name} ({menu.status === 'ACTIVE' ? 'ativo' : 'rascunho'})
                </option>
              ))}
            </select>
          </label>
          {menusQuery.data.menus.length === 0 && (
            <p className="mt-3 pratto-help">
              Nenhum menu editável está disponível para este estabelecimento.
            </p>
          )}
          {!menuId && menusQuery.data.menus.length > 0 && (
            <p className="mt-3 pratto-help">Selecione explicitamente o menu que deseja publicar.</p>
          )}
        </section>
      ) : null}

      {menuId && isLoadingPublication ? (
        <Skeleton className="h-56 rounded-2xl" />
      ) : menuId && publicationError ? (
        <ErrorState
          description={messageFor(publicationError)}
          onRetry={() => {
            void activeQuery.refetch();
            void historyQuery.refetch();
          }}
        />
      ) : !menuId ? (
        <EmptyState
          icon={Send}
          title="Escolha um menu"
          description="A publicação e a prévia sempre usam um menu explicitamente selecionado."
        />
      ) : (
        <>
          {!previewOnly ? (
            <section className="pratto-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">
                    Status atual
                  </p>
                  {publication ? (
                    <>
                      <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-herb">
                        <CheckCircle2 size={18} /> Publicado
                      </p>
                      <p className="mt-1 text-sm text-ink-faint">
                        Versão {publication.version} · {formatDate(publication.publishedAt)}
                      </p>
                      <p
                        className={`mt-3 text-sm font-medium ${hasUnpublishedChanges ? 'text-accent-deep' : 'text-herb'}`}
                        role={hasUnpublishedChanges ? 'status' : undefined}
                      >
                        {hasUnpublishedChanges
                          ? 'Há alterações aguardando publicação.'
                          : 'Tudo está publicado.'}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-lg font-semibold text-accent-deep">
                      Ainda não publicado
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  disabled={publish.isPending}
                  onClick={() => {
                    setFeedback(null);
                    publish.mutate();
                  }}
                >
                  <Send size={16} /> {publish.isPending ? 'Publicando…' : 'Publicar cardápio'}
                </Button>
              </div>
              {feedback && (
                <p
                  aria-live="polite"
                  className={`mt-4 text-sm ${feedback.type === 'success' ? 'text-herb' : 'text-accent-deep'}`}
                  role={feedback.type === 'error' ? 'alert' : undefined}
                >
                  {feedback.message}
                </p>
              )}
            </section>
          ) : null}

          {publication ? (
            <PublicMenuShare
              establishmentId={establishmentId}
              publicMenuBaseUrl={publicMenuBaseUrl}
              preview={previewOnly}
            />
          ) : null}

          {!previewOnly ? <PublicationHistory publications={history} /> : null}
        </>
      )}
    </div>
  );
}

function PublicationHistory({ publications }: { publications: MenuPublicationSummaryResponse[] }) {
  return (
    <section className="pratto-panel p-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Clock3 size={18} /> Histórico de publicações
      </h3>
      {publications.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">Nenhuma publicação registrada.</p>
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {publications.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <span className="font-medium text-ink">Versão {item.version}</span>
              <span className="text-ink-faint">{formatDate(item.publishedAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
