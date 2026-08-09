'use client';

import type { MenuPublicationSummaryResponse } from '@pratto/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiClientError } from '../auth/api-client';

import { catalogApi } from './api-client';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';

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

export function PublicationManagement({ establishmentId }: { establishmentId: string }) {
  const queryClient = useQueryClient();
  const [menuId, setMenuId] = useState<string | null>(null);
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
      setMenuId(null);
      setFeedback(null);
    }
  }, [menuId, menusQuery.data]);

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
      <p role="status" className="text-sm text-slate-400">
        Carregando menus de publicação…
      </p>
    );
  }
  if (menusQuery.error || !menusQuery.data) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200"
      >
        {messageFor(menusQuery.error)}
      </div>
    );
  }

  const publication = activeQuery.data?.publication ?? null;
  const history = historyQuery.data?.publications ?? [];
  const publicationError = activeQuery.error ?? historyQuery.error;
  const isLoadingPublication = menuId !== null && (activeQuery.isPending || historyQuery.isPending);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <label className="block text-sm font-medium" htmlFor="publication-menu-target">
          Menu para publicar
          <select
            id="publication-menu-target"
            className={inputClass}
            value={menuId ?? ''}
            onChange={(event) => {
              setMenuId(event.target.value || null);
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
          <p className="mt-3 text-sm text-slate-400">
            Nenhum menu editável está disponível para este estabelecimento.
          </p>
        )}
        {!menuId && menusQuery.data.menus.length > 0 && (
          <p className="mt-3 text-sm text-slate-400">
            Selecione explicitamente o menu que deseja publicar.
          </p>
        )}
      </section>

      {menuId && isLoadingPublication ? (
        <p role="status" className="text-sm text-slate-400">
          Consultando publicação…
        </p>
      ) : menuId && publicationError ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200"
        >
          {messageFor(publicationError)}
        </div>
      ) : !menuId ? null : (
        <>
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Status atual
                </p>
                {publication ? (
                  <>
                    <p className="mt-2 text-lg font-semibold text-emerald-300">Publicado</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Versão {publication.version} · {formatDate(publication.publishedAt)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-lg font-semibold text-amber-300">Ainda não publicado</p>
                )}
              </div>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={publish.isPending}
                onClick={() => {
                  setFeedback(null);
                  publish.mutate();
                }}
              >
                {publish.isPending ? 'Publicando…' : 'Publicar cardápio'}
              </button>
            </div>
            {feedback && (
              <p
                aria-live="polite"
                className={`mt-4 text-sm ${feedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}
                role={feedback.type === 'error' ? 'alert' : undefined}
              >
                {feedback.message}
              </p>
            )}
          </section>

          <PublicationHistory publications={history} />
        </>
      )}
    </div>
  );
}

function PublicationHistory({ publications }: { publications: MenuPublicationSummaryResponse[] }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-lg font-semibold">Histórico de publicações</h3>
      {publications.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Nenhuma publicação registrada.</p>
      ) : (
        <ol className="mt-4 divide-y divide-slate-800">
          {publications.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <span className="font-medium text-slate-200">Versão {item.version}</span>
              <span className="text-slate-400">{formatDate(item.publishedAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
