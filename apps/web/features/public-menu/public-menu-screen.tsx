'use client';

import type {
  AnalyticsInteractionType,
  PublicMenuMediaResponse,
  PublicMenuPageResponse,
  PublicMenuProductResponse,
} from '@pratto/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { ApiClientError } from '../auth/api-client';

import { PublicMenuAnalyticsClient } from './analytics-client';
import { publicMenuApi } from './api-client';
import type { PublicMenuServerError } from './server-api';

const PAGE_SIZE = 6;

export function PublicMenuScreen({
  publicId,
  slug,
  initialPage,
  initialError,
}: {
  publicId: string;
  slug: string;
  initialPage?: PublicMenuPageResponse;
  initialError?: PublicMenuServerError;
}) {
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<PublicMenuProductResponse | null>(null);
  const [retryInitialError, setRetryInitialError] = useState(!initialError);
  const analyticsRef = useRef<PublicMenuAnalyticsClient | null>(null);
  const impressionTimersRef = useRef(new Map<string, number>());
  const qualifiedTimersRef = useRef(new Map<string, number>());
  const trackedImpressionsRef = useRef(new Set<string>());
  const trackedQualifiedViewsRef = useRef(new Set<string>());
  if (!analyticsRef.current) analyticsRef.current = new PublicMenuAnalyticsClient();
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
    enabled: retryInitialError,
    initialData:
      initialPage && !categoryId
        ? { pages: [initialPage], pageParams: [undefined as string | undefined] }
        : undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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
    if (!firstPage) return;
    analyticsRef.current?.start({
      establishmentPublicId: publicId,
      publicationId: firstPage.menu.publicationId,
    });
    analyticsRef.current?.track({ eventType: 'menu_opened' });
  }, [firstPage, publicId]);

  useEffect(() => {
    return () => {
      analyticsRef.current?.stop();
    };
  }, []);

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

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || products.length === 0) return;
    const impressionTimers = impressionTimersRef.current;
    const qualifiedTimers = qualifiedTimersRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const productId = entry.target.getAttribute('data-product-id');
          const product = products.find((item) => item.id === productId);
          if (!productId || !product) continue;
          const ratio = entry.intersectionRatio;

          if (ratio >= 0.5 && !trackedImpressionsRef.current.has(productId)) {
            if (!impressionTimersRef.current.has(productId)) {
              const timer = window.setTimeout(() => {
                impressionTimersRef.current.delete(productId);
                trackedImpressionsRef.current.add(productId);
                analyticsRef.current?.track({
                  eventType: 'product_impression',
                  productId: product.id,
                  intersectionRatio: Math.max(0.5, ratio),
                  durationMs: 500,
                });
              }, 500);
              impressionTimersRef.current.set(productId, timer);
            }
          } else if (ratio < 0.5) {
            const timer = impressionTimersRef.current.get(productId);
            if (timer) window.clearTimeout(timer);
            impressionTimersRef.current.delete(productId);
          }

          if (ratio >= 0.7 && !trackedQualifiedViewsRef.current.has(productId)) {
            if (!qualifiedTimersRef.current.has(productId)) {
              const timer = window.setTimeout(() => {
                qualifiedTimersRef.current.delete(productId);
                trackedQualifiedViewsRef.current.add(productId);
                analyticsRef.current?.track({
                  eventType: 'product_viewed',
                  productId: product.id,
                  intersectionRatio: Math.max(0.7, ratio),
                  durationMs: 2_000,
                });
              }, 2_000);
              qualifiedTimersRef.current.set(productId, timer);
            }
          } else if (ratio < 0.7) {
            const timer = qualifiedTimersRef.current.get(productId);
            if (timer) window.clearTimeout(timer);
            qualifiedTimersRef.current.delete(productId);
          }
        }
      },
      { root: feed, threshold: [0, 0.5, 0.7] },
    );
    feed
      .querySelectorAll<HTMLElement>('[data-product-id]')
      .forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      for (const timer of impressionTimers.values()) window.clearTimeout(timer);
      for (const timer of qualifiedTimers.values()) window.clearTimeout(timer);
      impressionTimers.clear();
      qualifiedTimers.clear();
    };
  }, [products]);

  if (initialError && !retryInitialError) {
    return <PublicMenuError error={initialError} onRetry={() => setRetryInitialError(true)} />;
  }
  if (query.isPending) return <PublicMenuLoading />;
  if (query.error && !firstPage)
    return <PublicMenuError error={query.error} onRetry={() => void query.refetch()} />;
  if (!firstPage) return <PublicMenuError onRetry={() => void query.refetch()} />;

  const lightTheme = firstPage.establishment.theme.mode === 'LIGHT';
  const themeStyle = {
    '--menu-primary': firstPage.establishment.theme.primaryColor,
    colorScheme: lightTheme ? 'light' : 'dark',
  } as CSSProperties;

  const selectCategory = (nextCategoryId: string | undefined) => {
    if (nextCategoryId) {
      analyticsRef.current?.track({ eventType: 'category_selected', categoryId: nextCategoryId });
    }
    setCategoryId(nextCategoryId);
    if (feedRef.current && typeof feedRef.current.scrollTo === 'function') {
      feedRef.current.scrollTo({ top: 0, behavior: scrollBehavior() });
    }
  };

  return (
    <main
      className={`h-[100svh] overflow-hidden ${lightTheme ? 'bg-stone-50 text-slate-950' : 'bg-slate-950 text-white'}`}
      style={themeStyle}
    >
      <header
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b px-4 pb-8 pt-4 sm:px-6 ${lightTheme ? 'from-stone-50 via-stone-50/95' : 'from-slate-950 via-slate-950/90'} to-transparent`}
      >
        <div className="pointer-events-auto mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            {firstPage.establishment.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={`h-10 w-10 rounded-full border object-cover ${lightTheme ? 'border-slate-950/10' : 'border-white/20'}`}
                src={firstPage.establishment.logo.url}
                alt=""
                width={40}
                height={40}
              />
            ) : (
              <span
                className="grid h-10 w-10 place-items-center rounded-full font-bold text-white"
                style={{ backgroundColor: 'var(--menu-primary)' }}
              >
                {firstPage.establishment.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{firstPage.establishment.name}</h1>
              {firstPage.establishment.description && (
                <p
                  className={`truncate text-xs ${lightTheme ? 'text-slate-600' : 'text-slate-300'}`}
                >
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
                lightTheme={lightTheme}
                onClick={() => selectCategory(undefined)}
              />
              {firstPage.categories.map((category) => (
                <CategoryButton
                  key={category.id}
                  active={categoryId === category.id}
                  label={category.name}
                  lightTheme={lightTheme}
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
          lightTheme={lightTheme}
          onClear={() => selectCategory(undefined)}
        />
      ) : (
        <div
          ref={feedRef}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
          role="feed"
          tabIndex={0}
          aria-label="Produtos publicados"
          aria-busy={isFetchingNextPage}
        >
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              active={activeProductId === product.id}
              near={
                Math.abs(index - products.findIndex((item) => item.id === activeProductId)) <= 2
              }
              lightTheme={lightTheme}
              onOpenDetails={() => {
                analyticsRef.current?.track({
                  eventType: 'product_interaction',
                  productId: product.id,
                  interactionType: 'details_opened',
                });
                setDetailsProduct(product);
              }}
              onInteraction={(interactionType) =>
                analyticsRef.current?.track({
                  eventType: 'product_interaction',
                  productId: product.id,
                  interactionType,
                })
              }
            />
          ))}
          {isFetchingNextPage && <FeedLoadingCard lightTheme={lightTheme} />}
          {query.error && (
            <FeedError lightTheme={lightTheme} onRetry={() => void fetchNextPage()} />
          )}
        </div>
      )}

      {detailsProduct && (
        <ProductDetails
          product={detailsProduct}
          lightTheme={lightTheme}
          onClose={() => setDetailsProduct(null)}
        />
      )}
    </main>
  );
}

function CategoryButton({
  active,
  label,
  lightTheme,
  onClick,
}: {
  active: boolean;
  label: string;
  lightTheme: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--menu-primary)] ${
        active
          ? 'border-[var(--menu-primary)] bg-[var(--menu-primary)] text-white'
          : lightTheme
            ? 'border-slate-950/15 bg-white/80 text-slate-700 hover:border-slate-950/40'
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
  lightTheme,
  onOpenDetails,
  onInteraction,
}: {
  product: PublicMenuProductResponse;
  active: boolean;
  near: boolean;
  lightTheme: boolean;
  onOpenDetails: () => void;
  onInteraction: (interactionType: AnalyticsInteractionType) => void;
}) {
  return (
    <article
      className={`relative flex h-[100svh] snap-start items-end justify-center [contain-intrinsic-size:100svh] [content-visibility:auto] ${lightTheme ? 'bg-slate-100' : 'bg-slate-900'}`}
      data-product-id={product.id}
      aria-labelledby={`product-title-${product.id}`}
    >
      <div className="absolute inset-0">
        <MediaGallery
          product={product}
          active={active}
          loadMedia={near}
          lightTheme={lightTheme}
          onInteraction={onInteraction}
        />
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t px-5 pb-8 pt-36 sm:px-8 ${lightTheme ? 'from-white via-white/90' : 'from-slate-950 via-slate-950/80'} to-transparent`}
      >
        <div className="pointer-events-auto mx-auto max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--menu-primary)]">
            {product.featured && <span>Destaque</span>}
            {product.availability === 'TEMPORARILY_UNAVAILABLE' && (
              <span className="rounded-full bg-amber-400/20 px-2 py-1 text-amber-200">
                Indisponível no momento
              </span>
            )}
          </div>
          <h2
            id={`product-title-${product.id}`}
            className="text-3xl font-bold tracking-tight sm:text-5xl"
          >
            {product.name}
          </h2>
          <div className="mt-3 flex items-baseline gap-3">
            {product.promotionalPrice ? (
              <>
                <span className="text-2xl font-bold text-[var(--menu-primary)]">
                  {formatMoney(product.promotionalPrice)}
                </span>
                <span
                  className={`text-sm line-through ${lightTheme ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {formatMoney(product.price)}
                </span>
              </>
            ) : (
              <span className="text-2xl font-bold">{formatMoney(product.price)}</span>
            )}
          </div>
          {product.description && (
            <p
              className={`mt-3 line-clamp-2 max-w-xl text-sm leading-6 ${lightTheme ? 'text-slate-700' : 'text-slate-200'}`}
            >
              {product.description}
            </p>
          )}
          <button
            className={`mt-5 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--menu-primary)] ${lightTheme ? 'border-slate-950/20 bg-slate-950/5 hover:bg-slate-950/10' : 'border-white/30 bg-white/10 hover:bg-white/20'}`}
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
  lightTheme,
  onInteraction,
}: {
  product: PublicMenuProductResponse;
  active: boolean;
  loadMedia: boolean;
  lightTheme: boolean;
  onInteraction: (interactionType: AnalyticsInteractionType) => void;
}) {
  const [selectedMedia, setSelectedMedia] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  const media = product.media;
  const selected = media[selectedMedia];
  const poster = media.find((item) => item.mediaType === 'IMAGE')?.url;
  const selectMedia = (index: number) => {
    if (index !== selectedMedia) onInteraction('media_changed');
    setSelectedMedia(index);
    if (galleryRef.current && typeof galleryRef.current.scrollTo === 'function') {
      galleryRef.current.scrollTo({
        left: index * galleryRef.current.clientWidth,
        behavior: scrollBehavior(),
      });
    }
  };

  if (!loadMedia || media.length === 0 || !selected) {
    return (
      <div
        className={`grid h-full place-items-center px-8 text-center text-sm ${lightTheme ? 'bg-[radial-gradient(circle_at_top,#e2e8f0,#f8fafc_70%)] text-slate-600' : 'bg-[radial-gradient(circle_at_top,#334155,#020617_70%)] text-slate-400'}`}
      >
        {media.length === 0 ? 'Este produto ainda não possui uma imagem.' : 'Carregando mídia…'}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={galleryRef}
        className="h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        role="region"
        tabIndex={0}
        aria-label={`Mídias de ${product.name}`}
        onScroll={(event) => {
          const element = event.currentTarget;
          const nextIndex = Math.round(element.scrollLeft / element.clientWidth);
          if (nextIndex !== selectedMedia) onInteraction('media_changed');
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
                  lightTheme={lightTheme}
                  poster={poster}
                  productName={product.name}
                  onInteraction={() => onInteraction('video_sound_toggled')}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="h-full w-full object-cover"
                  src={item.url}
                  alt={`${product.name} — imagem ${index + 1}`}
                  loading={active && index === selectedMedia ? 'eager' : 'lazy'}
                  fetchPriority={active && index === selectedMedia ? 'high' : 'auto'}
                  decoding="async"
                  sizes="100vw"
                />
              )}
              <div className="absolute inset-0 bg-slate-950/10" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
      {media.length > 1 && (
        <div
          className={`absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full px-2 py-1 ${lightTheme ? 'bg-white/80' : 'bg-slate-950/60'}`}
        >
          {media.map((item, index) => (
            <button
              className={`h-1.5 rounded-full transition-all ${
                index === selectedMedia
                  ? 'w-5 bg-[var(--menu-primary)]'
                  : lightTheme
                    ? 'w-1.5 bg-slate-950/30'
                    : 'w-1.5 bg-white/50'
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
      <p
        className={`absolute bottom-5 left-5 z-10 text-xs ${lightTheme ? 'text-slate-700/70' : 'text-white/70'}`}
      >
        {media.length > 1 ? 'Deslize para ver mais mídias' : 'Mídia principal'}
      </p>
    </div>
  );
}

function VideoMedia({
  item,
  active,
  lightTheme,
  poster,
  productName,
  onInteraction,
}: {
  item: PublicMenuMediaResponse;
  active: boolean;
  lightTheme: boolean;
  poster?: string;
  productName: string;
  onInteraction: () => void;
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
        aria-label={`Vídeo de ${productName}`}
      />
      <button
        className={`absolute right-5 top-24 rounded-full border px-3 py-2 text-xs font-semibold backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--menu-primary)] ${lightTheme ? 'border-slate-950/20 bg-white/80 text-slate-950' : 'border-white/30 bg-slate-950/60 text-white'}`}
        type="button"
        aria-label={muted ? 'Ativar som do vídeo' : 'Desativar som do vídeo'}
        aria-pressed={!muted}
        onClick={() => {
          onInteraction();
          setMuted((value) => !value);
        }}
      >
        {muted ? 'Som desligado' : 'Som ligado'}
      </button>
    </>
  );
}

function ProductDetails({
  product,
  lightTheme,
  onClose,
}: {
  product: PublicMenuProductResponse;
  lightTheme: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/70 p-0 sm:items-center sm:justify-center sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        className={`max-h-[85svh] w-full max-w-xl overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl ${lightTheme ? 'bg-white text-slate-950' : 'bg-slate-900 text-white'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--menu-primary)]">
              Detalhes
            </p>
            <h2 id="product-details-title" className="mt-2 text-2xl font-bold">
              {product.name}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            className={`rounded-full border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--menu-primary)] ${lightTheme ? 'border-slate-950/20' : 'border-white/20'}`}
            type="button"
            aria-label="Fechar"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
        <div
          className={`mt-6 space-y-5 text-sm leading-6 ${lightTheme ? 'text-slate-700' : 'text-slate-200'}`}
        >
          {product.description && <p>{product.description}</p>}
          <div className="flex items-baseline gap-3">
            <strong className="text-xl text-[var(--menu-primary)]">
              {formatMoney(product.promotionalPrice ?? product.price)}
            </strong>
            {product.promotionalPrice && (
              <span className="text-slate-500 line-through">{formatMoney(product.price)}</span>
            )}
          </div>
          {product.ingredients && (
            <div>
              <h3 className={`font-semibold ${lightTheme ? 'text-slate-950' : 'text-white'}`}>
                Ingredientes
              </h3>
              <p>{product.ingredients}</p>
            </div>
          )}
          {product.allergens && (
            <div>
              <h3 className={`font-semibold ${lightTheme ? 'text-slate-950' : 'text-white'}`}>
                Alergênicos
              </h3>
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
    <main className="grid h-[100svh] place-items-center bg-stone-50 px-6 text-slate-950">
      <div
        className="w-full max-w-md space-y-4"
        role="status"
        aria-busy="true"
        aria-label="Carregando cardápio"
      >
        <div className="h-10 w-44 animate-pulse rounded-full bg-slate-200" />
        <div className="h-[60svh] animate-pulse rounded-3xl bg-slate-100" />
      </div>
    </main>
  );
}

function PublicMenuError({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const clientError = error instanceof ApiClientError ? error : undefined;
  const serverCode =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  const code = clientError?.code ?? serverCode;
  const notPublished = code === 'PUBLIC_MENU_NOT_PUBLISHED';
  const suspended = code === 'PUBLIC_MENU_SUSPENDED';
  const notFound = code === 'PUBLIC_MENU_NOT_FOUND';
  const retryable = !notPublished && !suspended && !notFound;
  const title = notPublished
    ? 'Cardápio ainda não publicado'
    : suspended
      ? 'Cardápio temporariamente indisponível'
      : notFound
        ? 'Cardápio não encontrado'
        : 'Não foi possível carregar este cardápio';
  const message = notPublished
    ? 'O estabelecimento ainda não disponibilizou uma versão pública.'
    : suspended
      ? 'Este cardápio está temporariamente indisponível.'
      : notFound
        ? 'Confira o endereço ou peça ao estabelecimento o link atualizado.'
        : (clientError?.message ??
          (error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string'
            ? error.message
            : 'Verifique sua conexão e tente novamente.'));
  return (
    <main className="grid min-h-[100svh] place-items-center bg-stone-50 px-6 text-center text-slate-950">
      <div className="max-w-md space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Pratto</p>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-sm leading-6 text-slate-600">{message}</p>
        {retryable && onRetry && (
          <button
            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            type="button"
            onClick={onRetry}
          >
            Tentar novamente
          </button>
        )}
        {(notPublished || suspended || notFound) && (
          <Link
            className="inline-flex rounded-full border border-slate-950/15 px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            href="/"
          >
            Ir para o início
          </Link>
        )}
      </div>
    </main>
  );
}

function PublicMenuEmpty({
  categorySelected,
  lightTheme,
  onClear,
}: {
  categorySelected: boolean;
  lightTheme: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className={`grid h-[100svh] place-items-center px-6 text-center ${lightTheme ? 'bg-stone-50 text-slate-950' : 'bg-slate-950 text-white'}`}
    >
      <div className="max-w-md space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--menu-primary)]">
          Pratto
        </p>
        <h2 className="text-3xl font-bold">Nenhum produto disponível</h2>
        <p className={`text-sm leading-6 ${lightTheme ? 'text-slate-600' : 'text-slate-400'}`}>
          {categorySelected
            ? 'Não há produtos publicados nesta categoria.'
            : 'Este cardápio ainda não possui produtos publicados.'}
        </p>
        {categorySelected && (
          <button
            className={`rounded-full border px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--menu-primary)] ${lightTheme ? 'border-slate-950/15' : 'border-white/20'}`}
            type="button"
            onClick={onClear}
          >
            Ver todas as categorias
          </button>
        )}
      </div>
    </div>
  );
}

function FeedLoadingCard({ lightTheme }: { lightTheme: boolean }) {
  return (
    <div
      className={`grid h-24 place-items-center text-sm ${lightTheme ? 'bg-stone-50 text-slate-600' : 'bg-slate-950 text-slate-400'}`}
      role="status"
    >
      Carregando mais produtos…
    </div>
  );
}

function FeedError({ lightTheme, onRetry }: { lightTheme: boolean; onRetry: () => void }) {
  return (
    <div
      className={`grid min-h-24 place-items-center gap-2 px-6 py-5 text-center text-sm ${lightTheme ? 'bg-stone-50 text-slate-600' : 'bg-slate-950 text-slate-300'}`}
      role="alert"
    >
      <span>Não foi possível carregar mais produtos.</span>
      <button
        className="rounded-full border border-[var(--menu-primary)] px-4 py-2 font-semibold text-[var(--menu-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--menu-primary)]"
        type="button"
        onClick={onRetry}
      >
        Tentar novamente
      </button>
    </div>
  );
}

function scrollBehavior(): ScrollBehavior {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }
  return 'smooth';
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `R$ ${value}`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}
