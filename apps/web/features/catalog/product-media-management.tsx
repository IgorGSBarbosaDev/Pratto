'use client';

import type { ProductMediaResponse } from '@pratto/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { ApiClientError } from '../auth/api-client';

import { catalogApi } from './api-client';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível concluir a solicitação.';
}

export function ProductMediaManagement({
  menuId,
  productId,
}: {
  menuId: string;
  productId: string;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const queryKey = ['catalog-product-media', menuId, productId] as const;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const mediaQuery = useQuery({
    queryKey,
    queryFn: () => catalogApi.listProductMedia(menuId, productId),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const upload = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('Selecione um arquivo.');
      return catalogApi.uploadProductMedia(menuId, productId, selectedFile);
    },
    onSuccess: async () => {
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = '';
      await invalidate();
    },
  });
  const primary = useMutation({
    mutationFn: (mediaId: string) => catalogApi.setProductMediaPrimary(menuId, productId, mediaId),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (mediaId: string) => catalogApi.removeProductMedia(menuId, productId, mediaId),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: (mediaIds: string[]) =>
      catalogApi.reorderProductMedia(menuId, productId, { mediaIds }),
    onSuccess: invalidate,
  });
  const media = mediaQuery.data?.media ?? [];
  const busy = upload.isPending || primary.isPending || remove.isPending || reorder.isPending;

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-medium">Mídias do produto</h5>
          <p className="mt-1 text-xs text-slate-500">
            JPEG, PNG, WebP até 5 MB; MP4, WebM ou MOV até 50 MB.
          </p>
        </div>
        <span className="text-xs text-slate-500">{media.length} arquivos</span>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 text-xs text-slate-400">
          Arquivo de imagem ou vídeo
          <input
            ref={fileInput}
            className={inputClass}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={busy || !selectedFile}
          onClick={() => upload.mutate()}
        >
          {upload.isPending ? 'Enviando…' : 'Enviar mídia'}
        </button>
      </div>
      {mediaQuery.isPending ? (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Carregando mídias…
        </p>
      ) : mediaQuery.error ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {messageFor(mediaQuery.error)}
        </p>
      ) : media.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
          Nenhuma mídia cadastrada para este produto.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {media.map((item, index) => (
            <MediaCard
              key={item.id}
              item={item}
              index={index}
              total={media.length}
              busy={busy}
              onPrimary={() => primary.mutate(item.id)}
              onRemove={() => remove.mutate(item.id)}
              onMove={(direction) => {
                const next = media.map((mediaItem) => mediaItem.id);
                const target = index + direction;
                if (target < 0 || target >= next.length) return;
                [next[index], next[target]] = [next[target]!, next[index]!];
                reorder.mutate(next);
              }}
            />
          ))}
        </div>
      )}
      {(upload.error || primary.error || remove.error || reorder.error) && (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {messageFor(upload.error ?? primary.error ?? remove.error ?? reorder.error)}
        </p>
      )}
    </div>
  );
}

function MediaCard({
  item,
  index,
  total,
  busy,
  onPrimary,
  onRemove,
  onMove,
}: {
  item: ProductMediaResponse;
  index: number;
  total: number;
  busy: boolean;
  onPrimary: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="aspect-video bg-slate-900">
        {item.mediaType === 'IMAGE' ? (
          // MinIO's public URL is environment-specific and is not routed through Next image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover" src={item.url} alt={item.originalName} />
        ) : (
          <video
            className="h-full w-full object-cover"
            controls
            preload="metadata"
            src={item.url}
          />
        )}
      </div>
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2 text-xs">
          <span className="truncate text-slate-300" title={item.originalName}>
            {item.originalName}
          </span>
          {item.isPrimary && (
            <span className="shrink-0 rounded-full bg-emerald-950 px-2 py-0.5 text-emerald-300">
              Principal
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-50"
            type="button"
            disabled={busy || item.isPrimary}
            onClick={onPrimary}
          >
            Definir principal
          </button>
          <button
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-50"
            type="button"
            disabled={busy || index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Mover ${item.originalName} para cima`}
          >
            ↑
          </button>
          <button
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-50"
            type="button"
            disabled={busy || index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Mover ${item.originalName} para baixo`}
          >
            ↓
          </button>
          <button
            className="rounded border border-rose-900 px-2 py-1 text-xs text-rose-300 hover:border-rose-500 disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={onRemove}
          >
            Remover
          </button>
        </div>
      </div>
    </article>
  );
}
