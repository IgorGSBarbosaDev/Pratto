'use client';

import type { PublicMenuMediaResponse, PublicMenuProductResponse } from '@pratto/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiClientError } from '../auth/api-client';

import { publicMenuApi } from './api-client';

const PAGE_SIZE = 6;

export function PublicMenuScreen({ publicId, slug }: { publicId: string; slug: string }) {
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<PublicMenuProductResponse | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['public-menu', publicId, categoryId ?? 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      publicMenuApi.getPage(publicId, {
        cursor: pageParam,
        categoryId,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  const firstPage = query.data?.pages[0];
  const products = useMemo(
    () => query.data?.pages.flatMap((page) => page.products) ?? [],
    [query.data],
  );
  const firstProductId = products[0]?.id ?? null;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  useEffect(() => {
    if (firstPage && firstPage.establishment.slug !== slug) {
      router.replace(`/menu/${encodeURIComponent(publicId)}/${firstPage.establishment.slug}`);
    }
  }, [firstPage, publicId, router, slug]);

  useEffect(() => {
    setActiveProductId(firstProductId);
  }, [categoryId, firstProductId]);

  useEffect(() => {
    if (products.length > 0 && !products.some((product) => product.id === activeProductId)) {
      setActiveProductId(products[0]?.id ?? null);
    }
  }, [activeProductId, products]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || products.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) return;
        const productId = visible.target.getAttribute('data-product-id');
        if (productId) setActiveProductId(productId);
        const index = products.findIndex((product) => product.id === productId);
        if (index >= products.length - 2 && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root: feed, threshold: [0.55, 0.8] },
    );
    feed
      .querySelectorAll<HTMLElement>('[data-product-id]')
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, products]);

  if (query.isPending) return <PublicMenuLoading />;
  if (query.error)
    return <PublicMenuError error={query.error} onRetry={() => void query.refetch()} />;
  if (!firstPage) return <PublicMenuError onRetry={() => void query.refetch()} />;

  const selectCategory = (nextCategoryId: string | undefined) => {
    setCategoryId(nextCategoryId);
    if (feedRef.current && typeof feedRef.current.scrollTo === 'function') {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <main className="h-[100svh] overflow-hidden bg-slate-950 text-white">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-slate-950 via-slate-950/90 to-transparent px-4 pb-8 pt-4 sm:px-6">
        <div className="pointer-events-auto mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            {firstPage.establishment.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="h-10 w-10 rounded-full border border-white/20 object-cover"
                src={firstPage.establishment.logo.url}
                alt=""
                width={40}
                height={40}
              />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-700 font-bold">
                {firstPage.establishment.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{firstPage.establishment.name}</h1>
              {firstPage.establishment.description && (
                <p className="truncate text-xs text-slate-300">
                  {firstPage.establishment.description}
                </p>
              )}
            </div>
          </div>
          {firstPage.categories.length > 0 && (
            <nav
              className="mt-4 flex gap-2 overflow-x-auto pb-1"
              aria-label="Categorias do cardápio"
            >
              <CategoryButton
                active={!categoryId}
                label="Todos"
                onClick={() => selectCategory(undefined)}
              />
              {firstPage.categories.map((category) => (
                <CategoryButton
                  key={category.id}
                  active={categoryId === category.id}
                  label={category.name}
                  onClick={() => selectCategory(category.id)}
                />
              ))}
            </nav>
          )}
        </div>
      </header>

      {products.length === 0 ? (
        <PublicMenuEmpty
          categorySelected={Boolean(categoryId)}
          onClear={() => selectCategory(undefined)}
        />
      ) : (
        <div
          ref={feedRef}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain scroll-smooth"
          aria-label="Produtos publicados"
        >
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              active={activeProductId === product.id}
              near={
                Math.abs(index - products.findIndex((item) => item.id === activeProductId)) <= 2
              }
              onOpenDetails={() => setDetailsProduct(product)}
            />
          ))}
          {isFetchingNextPage && <FeedLoadingCard />}
        </div>
      )}

      {detailsProduct && (
        <ProductDetails product={detailsProduct} onClose={() => setDetailsProduct(null)} />
      )}
    </main>
  );
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-emerald-400 bg-emerald-500 text-slate-950'
          : 'border-white/20 bg-slate-950/60 text-slate-200 hover:border-white/50'
      }`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ProductCard({
  product,
  active,
  near,
  onOpenDetails,
}: {
  product: PublicMenuProductResponse;
  active: boolean;
  near: boolean;
  onOpenDetails: () => void;
}) {
  return (
    <article
      className="relative flex h-[100svh] snap-start items-end justify-center bg-slate-900 [contain-intrinsic-size:100svh] [content-visibility:auto]"
      data-product-id={product.id}
    >
      <div className="absolute inset-0">
        <MediaGallery product={product} active={active} loadMedia={near} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent px-5 pb-8 pt-36 sm:px-8">
        <div className="pointer-events-auto mx-auto max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">
            {product.featured && <span>Destaque</span>}
            {product.availability === 'TEMPORARILY_UNAVAILABLE' && (
              <span className="rounded-full bg-amber-400/20 px-2 py-1 text-amber-200">
                Indisponível no momento
              </span>
            )}
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{product.name}</h2>
          <div className="mt-3 flex items-baseline gap-3">
            {product.promotionalPrice ? (
              <>
                <span className="text-2xl font-bold text-emerald-300">
                  {formatMoney(product.promotionalPrice)}
                </span>
                <span className="text-sm text-slate-400 line-through">
                  {formatMoney(product.price)}
                </span>
              </>
            ) : (
              <span className="text-2xl font-bold">{formatMoney(product.price)}</span>
            )}
          </div>
          {product.description && (
            <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-slate-200">
              {product.description}
            </p>
          )}
          <button
            className="mt-5 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/20"
            type="button"
            onClick={onOpenDetails}
          >
            Ver detalhes
          </button>
        </div>
      </div>
    </article>
  );
}

function MediaGallery({
  product,
  active,
  loadMedia,
}: {
  product: PublicMenuProductResponse;
  active: boolean;
  loadMedia: boolean;
}) {
  const [selectedMedia, setSelectedMedia] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const media = product.media;
  const selected = media[selectedMedia];
  const poster = media.find((item) => item.mediaType === 'IMAGE')?.url;
  const selectMedia = (index: number) => {
    setSelectedMedia(index);
    if (galleryRef.current && typeof galleryRef.current.scrollTo === 'function') {
      galleryRef.current.scrollTo({
        left: index * galleryRef.current.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  if (!loadMedia || media.length === 0 || !selected) {
    return (
      <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_top,#334155,#020617_70%)] px-8 text-center text-sm text-slate-400">
        {media.length === 0 ? 'Este produto ainda não possui uma imagem.' : 'Carregando mídia…'}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={galleryRef}
        className="h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        onScroll={(event) => {
          const element = event.currentTarget;
          const nextIndex = Math.round(element.scrollLeft / element.clientWidth);
          setSelectedMedia(Math.max(0, Math.min(nextIndex, media.length - 1)));
        }}
      >
        <div className="flex h-full w-full">
          {media.map((item, index) => (
            <div className="relative h-full min-w-full snap-center" key={item.id}>
              {item.mediaType === 'VIDEO' ? (
                <VideoMedia
                  item={item}
                  active={active && index === selectedMedia}
                  poster={poster}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="h-full w-full object-cover"
                  src={item.url}
                  alt={`${product.name} — imagem ${index + 1}`}
                  loading={active && index === selectedMedia ? 'eager' : 'lazy'}
                  decoding="async"
                />
              )}
              <div className="absolute inset-0 bg-slate-950/10" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
      {media.length > 1 && (
        <div className="absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-slate-950/60 px-2 py-1">
          {media.map((item, index) => (
            <button
              className={`h-1.5 rounded-full transition-all ${
                index === selectedMedia ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
              }`}
              key={item.id}
              type="button"
              aria-label={`Mostrar mídia ${index + 1} de ${media.length}`}
              aria-pressed={index === selectedMedia}
              onClick={() => selectMedia(index)}
            />
          ))}
        </div>
      )}
      <p className="absolute bottom-5 left-5 z-10 text-xs text-white/70">
        {media.length > 1 ? 'Deslize para ver mais mídias' : 'Mídia principal'}
      </p>
    </div>
  );
}

function VideoMedia({
  item,
  active,
  poster,
}: {
  item: PublicMenuMediaResponse;
  active: boolean;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && !reducedMotion) {
      video.muted = muted;
      void video.play().catch(() => undefined);
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active, muted, reducedMotion]);

  return (
    <>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={item.url}
        poster={poster}
        muted={muted}
        playsInline
        loop
        preload="none"
        aria-label="Vídeo do produto"
      />
      <button
        className="absolute right-5 top-24 rounded-full border border-white/30 bg-slate-950/60 px-3 py-2 text-xs font-semibold backdrop-blur"
        type="button"
        aria-label={muted ? 'Ativar som do vídeo' : 'Desativar som do vídeo'}
        aria-pressed={!muted}
        onClick={() => setMuted((value) => !value)}
      >
        {muted ? 'Som desligado' : 'Som ligado'}
      </button>
    </>
  );
}

function ProductDetails({
  product,
  onClose,
}: {
  product: PublicMenuProductResponse;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/70 p-0 sm:items-center sm:justify-center sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="max-h-[85svh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-slate-900 p-6 shadow-2xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Detalhes
            </p>
            <h2 id="product-details-title" className="mt-2 text-2xl font-bold">
              {product.name}
            </h2>
          </div>
          <button
            className="rounded-full border border-white/20 px-3 py-2 text-sm"
            type="button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
        <div className="mt-6 space-y-5 text-sm leading-6 text-slate-200">
          {product.description && <p>{product.description}</p>}
          <div className="flex items-baseline gap-3">
            <strong className="text-xl text-emerald-300">
              {formatMoney(product.promotionalPrice ?? product.price)}
            </strong>
            {product.promotionalPrice && (
              <span className="text-slate-400 line-through">{formatMoney(product.price)}</span>
            )}
          </div>
          {product.ingredients && (
            <div>
              <h3 className="font-semibold text-white">Ingredientes</h3>
              <p>{product.ingredients}</p>
            </div>
          )}
          {product.allergens && (
            <div>
              <h3 className="font-semibold text-white">Alergênicos</h3>
              <p>{product.allergens}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PublicMenuLoading() {
  return (
    <main className="grid h-[100svh] place-items-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md space-y-4" role="status" aria-label="Carregando cardápio">
        <div className="h-10 w-44 animate-pulse rounded-full bg-slate-800" />
        <div className="h-[60svh] animate-pulse rounded-3xl bg-slate-900" />
      </div>
    </main>
  );
}

function PublicMenuError({ error, onRetry }: { error?: unknown; onRetry: () => void }) {
  const clientError = error instanceof ApiClientError ? error : undefined;
  const notPublished = clientError?.code === 'PUBLIC_MENU_NOT_PUBLISHED';
  return (
    <main className="grid min-h-[100svh] place-items-center bg-slate-950 px-6 text-center text-white">
      <div className="max-w-md space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Pratto</p>
        <h1 className="text-3xl font-bold">
          {notPublished
            ? 'Cardápio ainda não publicado'
            : 'Não foi possível carregar este cardápio'}
        </h1>
        <p className="text-sm leading-6 text-slate-400">
          {notPublished
            ? 'O estabelecimento ainda não disponibilizou uma versão pública.'
            : (clientError?.message ?? 'Verifique sua conexão e tente novamente.')}
        </p>
        {!notPublished && (
          <button
            className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950"
            type="button"
            onClick={onRetry}
          >
            Tentar novamente
          </button>
        )}
      </div>
    </main>
  );
}

function PublicMenuEmpty({
  categorySelected,
  onClear,
}: {
  categorySelected: boolean;
  onClear: () => void;
}) {
  return (
    <main className="grid h-[100svh] place-items-center bg-slate-950 px-6 text-center text-white">
      <div className="max-w-md space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Pratto</p>
        <h1 className="text-3xl font-bold">Nenhum produto disponível</h1>
        <p className="text-sm leading-6 text-slate-400">
          {categorySelected
            ? 'Não há produtos publicados nesta categoria.'
            : 'Este cardápio ainda não possui produtos publicados.'}
        </p>
        {categorySelected && (
          <button
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold"
            type="button"
            onClick={onClear}
          >
            Ver todas as categorias
          </button>
        )}
      </div>
    </main>
  );
}

function FeedLoadingCard() {
  return (
    <div className="grid h-24 place-items-center bg-slate-950 text-sm text-slate-400" role="status">
      Carregando mais produtos…
    </div>
  );
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `R$ ${value}`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}
