'use client';

import type { ProductMediaResponse } from '@pratto/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { ApiClientError } from '../auth/api-client';

import { catalogApi } from './api-client';

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
    <div className="rounded-2xl border border-line bg-cream p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-medium">Mídias do produto</h5>
          <p className="mt-1 text-xs text-ink-faint">
            JPEG, PNG, WebP até 5 MB; MP4, WebM ou MOV até 50 MB.
          </p>
        </div>
        <span className="text-xs text-ink-faint">{media.length} arquivos</span>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 text-xs font-medium text-ink-soft">
          <span>Arquivo de imagem ou vídeo</span>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <span className="mt-1 flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-cream px-3.5 transition hover:border-ink/25 hover:bg-sand/35">
            <span className="rounded-lg bg-sand px-3 py-1.5 text-xs font-semibold text-ink">
              Escolher arquivo
            </span>
            <span className="min-w-0 truncate text-xs font-normal text-ink-faint">
              {selectedFile?.name ?? 'Nenhum arquivo selecionado'}
            </span>
          </span>
        </label>
        <button
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent-deep px-4 text-sm font-medium text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={busy || !selectedFile}
          onClick={() => upload.mutate()}
        >
          <ImagePlus size={16} /> {upload.isPending ? 'Enviando…' : 'Enviar mídia'}
        </button>
      </div>
      {mediaQuery.isPending ? (
        <p role="status" className="mt-4 text-sm text-ink-faint">
          Carregando mídias…
        </p>
      ) : mediaQuery.error ? (
        <p role="alert" className="mt-4 pratto-error">
          {messageFor(mediaQuery.error)}
        </p>
      ) : media.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-4 text-sm text-ink-faint">
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
        <p role="alert" className="mt-4 pratto-error">
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
    <article className="overflow-hidden rounded-xl border border-line bg-cream">
      <div className="aspect-video bg-sand">
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
          <span className="truncate text-ink-soft" title={item.originalName}>
            {item.originalName}
          </span>
          {item.isPrimary && (
            <span className="shrink-0 rounded-full bg-herb/10 px-2 py-0.5 text-herb">
              Principal
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:border-ink/30 disabled:opacity-50"
            type="button"
            disabled={busy || item.isPrimary}
            onClick={onPrimary}
          >
            <Star size={12} /> Definir principal
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-faint hover:border-ink/30 disabled:opacity-50"
            type="button"
            disabled={busy || index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Mover ${item.originalName} para cima`}
          >
            <ChevronUp size={13} />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-faint hover:border-ink/30 disabled:opacity-50"
            type="button"
            disabled={busy || index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Mover ${item.originalName} para baixo`}
          >
            <ChevronDown size={13} />
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-accent/20 px-2 py-1 text-xs text-accent-deep hover:border-accent/50 disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 size={12} /> Remover
          </button>
        </div>
      </div>
    </article>
  );
}
