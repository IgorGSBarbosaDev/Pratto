'use client';

import type {
  AnalyticsContactType,
  AnalyticsInteractionType,
  PublicMenuMediaResponse,
  PublicMenuPageResponse,
  PublicMenuProductResponse,
} from '@pratto/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ChevronsDown,
  Clock3,
  LayoutGrid,
  MapPin,
  Store,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { ApiClientError } from '../auth/api-client';
import { FoodImage, Skeleton } from '../design-system/feedback';
import { useModalDialog } from '../design-system/use-modal-dialog';

import { PublicMenuAnalyticsClient } from './analytics-client';
import { publicMenuApi } from './api-client';
import {
  ProductShareButton,
  ProductShareSheet,
  ProductShareToast,
  type ShareFeedback,
} from './product-share-sheet';
import type { PublicMenuServerError } from './server-api';

const PAGE_SIZE = 6;
type CustomerTab = 'menu' | 'categories' | 'restaurant';
const PUBLIC_DAYS = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

export function PublicMenuScreen({
  publicId,
  slug,
  initialPage,
  initialError,
  initialProductId,
}: {
  publicId: string;
  slug: string;
  initialPage?: PublicMenuPageResponse;
  initialError?: PublicMenuServerError;
  initialProductId?: string;
}) {
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [entered, setEntered] = useState(Boolean(initialProductId));
  const [tab, setTab] = useState<CustomerTab>('menu');
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<PublicMenuProductResponse | null>(null);
  const [shareProduct, setShareProduct] = useState<PublicMenuProductResponse | null>(null);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback | null>(null);
  const [retryInitialError, setRetryInitialError] = useState(!initialError);
  const deepLinkResolvedRef = useRef(false);
  const feedbackIdRef = useRef(0);
  const showShareFeedback = useCallback((message: string, tone: ShareFeedback['tone']) => {
    feedbackIdRef.current += 1;
    setShareFeedback({ id: feedbackIdRef.current, message, tone });
  }, []);
  const dismissShareFeedback = useCallback(() => setShareFeedback(null), []);
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
      const path = `/menu/${encodeURIComponent(publicId)}/${firstPage.establishment.slug}`;
      router.replace(
        initialProductId ? `${path}?product=${encodeURIComponent(initialProductId)}` : path,
      );
    }
  }, [firstPage, initialProductId, publicId, router, slug]);

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
    if (!initialProductId || deepLinkResolvedRef.current || !firstPage) return;
    const product = products.find((item) => item.id === initialProductId);
    if (product) {
      deepLinkResolvedRef.current = true;
      setActiveProductId(product.id);
      window.requestAnimationFrame(() => {
        const target = Array.from(
          feedRef.current?.querySelectorAll<HTMLElement>('[data-product-id]') ?? [],
        ).find((element) => element.dataset.productId === product.id);
        if (target && feedRef.current && typeof feedRef.current.scrollTo === 'function') {
          feedRef.current.scrollTo({ top: target.offsetTop, behavior: 'auto' });
        }
      });
      return;
    }
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
      return;
    }
    if (!hasNextPage) deepLinkResolvedRef.current = true;
  }, [fetchNextPage, firstPage, hasNextPage, initialProductId, isFetchingNextPage, products]);

  useEffect(() => {
    if (!entered || tab !== 'menu') return;
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
  }, [entered, fetchNextPage, hasNextPage, isFetchingNextPage, products, tab]);

  useEffect(() => {
    if (!entered || tab !== 'menu') return;
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
  }, [entered, products, tab]);

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
    '--menu-primary-deep': darkenColor(firstPage.establishment.theme.primaryColor),
    colorScheme: lightTheme ? 'light' : 'dark',
  } as CSSProperties;

  const selectCategory = (nextCategoryId: string | undefined) => {
    if (nextCategoryId) {
      analyticsRef.current?.track({ eventType: 'category_selected', categoryId: nextCategoryId });
    }
    setCategoryId(nextCategoryId);
    setTab('menu');
    if (feedRef.current && typeof feedRef.current.scrollTo === 'function') {
      feedRef.current.scrollTo({ top: 0, behavior: scrollBehavior() });
    }
  };

  const categories = firstPage.categories;
  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? firstPage.menu.name;
  const fallbackImage = firstPage.establishment.coverImage?.url;

  return (
    <main
      className="min-h-[100dvh] bg-sand sm:grid sm:place-items-center sm:p-6"
      style={themeStyle}
    >
      <section
        className={`relative h-[100dvh] w-full overflow-hidden sm:h-[812px] sm:w-[390px] sm:rounded-[36px] sm:ring-1 sm:ring-black/10 sm:shadow-[0_40px_80px_-30px_rgba(24,23,22,.45)] ${lightTheme ? 'bg-cream text-ink' : 'bg-ink text-white'}`}
        aria-label={`Cardápio de ${firstPage.establishment.name}`}
      >
        {!entered ? (
          <RestaurantEntry
            page={firstPage}
            lightTheme={lightTheme}
            onEnter={() => setEntered(true)}
          />
        ) : (
          <>
            {tab === 'menu' ? (
              <div className="fade-in absolute inset-0" key={categoryId ?? 'all'}>
                {products.length === 0 ? (
                  <PublicMenuEmpty
                    categorySelected={Boolean(categoryId)}
                    lightTheme={lightTheme}
                    onClear={() => selectCategory(undefined)}
                  />
                ) : (
                  <div
                    ref={feedRef}
                    className="snap-y-feed no-scrollbar flex h-full flex-col overflow-y-scroll overscroll-y-contain"
                    role="feed"
                    tabIndex={0}
                    aria-label="Produtos publicados"
                    aria-busy={isFetchingNextPage}
                  >
                    {products.map((product, index) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        categoryName={categoryName(product.categoryId)}
                        active={activeProductId === product.id}
                        near={
                          Math.abs(
                            index - products.findIndex((item) => item.id === activeProductId),
                          ) <= 2
                        }
                        lightTheme={lightTheme}
                        showHint={
                          index === 0 && products.length > 1 && activeProductId === product.id
                        }
                        onOpenDetails={() => {
                          analyticsRef.current?.track({
                            eventType: 'product_interaction',
                            productId: product.id,
                            interactionType: 'details_opened',
                          });
                          setDetailsProduct(product);
                        }}
                        onOpenShare={() => setShareProduct(product)}
                        onInteraction={(interactionType) =>
                          analyticsRef.current?.track({
                            eventType: 'product_interaction',
                            productId: product.id,
                            interactionType,
                          })
                        }
                      />
                    ))}
                    {isFetchingNextPage ? <FeedLoadingCard lightTheme={lightTheme} /> : null}
                    {query.error ? (
                      <FeedError lightTheme={lightTheme} onRetry={() => void fetchNextPage()} />
                    ) : null}
                  </div>
                )}
                {categories.length > 0 ? (
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-3">
                    <nav
                      className="no-scrollbar pointer-events-auto flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 py-1 [mask-image:linear-gradient(to_right,transparent,#000_18px,#000_calc(100%-24px),transparent)]"
                      aria-label="Categorias do cardápio"
                    >
                      <CategoryButton
                        active={!categoryId}
                        label="Populares"
                        onClick={() => selectCategory(undefined)}
                      />
                      {categories.map((category) => (
                        <CategoryButton
                          key={category.id}
                          active={categoryId === category.id}
                          label={category.name}
                          onClick={() => selectCategory(category.id)}
                        />
                      ))}
                      <span aria-hidden className="w-1 shrink-0" />
                    </nav>
                  </div>
                ) : null}
              </div>
            ) : null}
            {tab === 'categories' ? (
              <CategoryGrid
                categories={categories}
                products={products}
                fallbackImage={fallbackImage}
                lightTheme={lightTheme}
                onPick={(id) => selectCategory(id)}
              />
            ) : null}
            {tab === 'restaurant' ? (
              <RestaurantInfo
                page={firstPage}
                lightTheme={lightTheme}
                onContactClick={(contactType) => {
                  analyticsRef.current?.track({ eventType: 'contact_clicked', contactType });
                  analyticsRef.current?.flushNow();
                }}
              />
            ) : null}
            <BottomNav
              active={tab}
              overlay={tab === 'menu'}
              lightTheme={lightTheme}
              onChange={setTab}
            />
            {detailsProduct ? (
              <ProductDetails
                product={detailsProduct}
                categoryName={categoryName(detailsProduct.categoryId)}
                lightTheme={lightTheme}
                onInteraction={(interactionType) =>
                  analyticsRef.current?.track({
                    eventType: 'product_interaction',
                    productId: detailsProduct.id,
                    interactionType,
                  })
                }
                onClose={() => setDetailsProduct(null)}
              />
            ) : null}
            {shareProduct ? (
              <ProductShareSheet
                publicId={publicId}
                slug={firstPage.establishment.slug}
                establishmentName={firstPage.establishment.name}
                product={shareProduct}
                lightTheme={lightTheme}
                onClose={() => setShareProduct(null)}
                onFeedback={showShareFeedback}
              />
            ) : null}
            {shareFeedback ? (
              <ProductShareToast
                key={shareFeedback.id}
                feedback={shareFeedback}
                onDismiss={dismissShareFeedback}
              />
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function RestaurantEntry({
  page,
  lightTheme,
  onEnter,
}: {
  page: PublicMenuPageResponse;
  lightTheme: boolean;
  onEnter: () => void;
}) {
  const establishment = page.establishment;
  const open = isOpenNow(establishment.operatingHours);
  const location = [establishment.address?.neighborhood, establishment.address?.city]
    .filter(Boolean)
    .join(', ');
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${lightTheme ? 'bg-cream text-ink' : 'bg-ink text-white'}`}
    >
      {establishment.coverImage ? (
        <FoodImage src={establishment.coverImage.url} alt="" className="h-[46%] w-full" />
      ) : (
        <div className={`h-[46%] w-full ${lightTheme ? 'bg-sand' : 'bg-ink-soft'}`} />
      )}
      <div
        className={`pointer-events-none absolute left-0 top-0 h-[46%] w-full bg-gradient-to-t ${lightTheme ? 'from-cream' : 'from-ink'} via-transparent to-transparent`}
      />
      <div className="relative -mt-14 flex flex-col items-center px-6 text-center">
        <div
          className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl shadow-[0_18px_40px_-18px_rgba(24,23,22,.6)] ${lightTheme ? 'bg-ink text-cream' : 'bg-cream text-ink'}`}
        >
          {establishment.logo ? (
            <FoodImage src={establishment.logo.url} alt="" className="h-full w-full" />
          ) : (
            <span className="font-serif text-5xl">
              {establishment.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <span
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${open ? 'bg-herb/10 text-herb' : lightTheme ? 'bg-ink/5 text-ink-soft' : 'bg-white/10 text-white/75'}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-herb' : 'bg-ink-faint'}`} />
          {open ? 'Aberto agora' : 'Fechado agora'}
        </span>
        <h1 className="mt-3 font-serif text-[42px] leading-none">{establishment.name}</h1>
        <p className="mt-1 text-[15px] font-medium uppercase tracking-[0.16em] text-[var(--menu-primary-deep)]">
          {page.menu.name}
        </p>
        {establishment.description ? (
          <p
            className={`mt-4 line-clamp-3 max-w-[320px] text-[15px] leading-relaxed ${lightTheme ? 'text-ink-soft' : 'text-white/75'}`}
          >
            {establishment.description}
          </p>
        ) : null}
        {location ? (
          <div
            className={`mt-4 flex items-center gap-1.5 text-sm ${lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}`}
          >
            <MapPin size={15} />
            <span>{location}</span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onEnter}
          className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--menu-primary)] px-7 py-3.5 text-[16px] font-medium text-white shadow-[0_14px_30px_-12px_var(--menu-primary)] transition-all hover:brightness-90 active:scale-[0.98]"
        >
          Explorar o menu{' '}
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
        </button>
        <p className={`mt-3 text-xs ${lightTheme ? 'text-ink-faint' : 'text-white/[0.45]'}`}>
          Deslize para descobrir cada prato
        </p>
      </div>
    </div>
  );
}

function CategoryGrid({
  categories,
  products,
  fallbackImage,
  lightTheme,
  onPick,
}: {
  categories: PublicMenuPageResponse['categories'];
  products: PublicMenuProductResponse[];
  fallbackImage?: string;
  lightTheme: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div
      className={`no-scrollbar h-full overflow-y-auto px-4 pb-28 pt-5 ${lightTheme ? 'bg-cream text-ink' : 'bg-ink text-white'}`}
    >
      <h1 className="px-1 font-serif text-[32px] leading-tight">Categorias</h1>
      <p className={`mb-4 px-1 text-[15px] ${lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}`}>
        Escolha por onde começar.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((category) => {
          const image =
            products
              .find((product) => product.categoryId === category.id)
              ?.media.find((media) => media.mediaType === 'IMAGE')?.url ?? fallbackImage;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onPick(category.id)}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand text-left"
            >
              {image ? (
                <FoodImage
                  src={image}
                  alt=""
                  className="h-full w-full"
                  imgClassName="transition-transform duration-500 group-hover:scale-105"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute bottom-3 left-3 font-serif text-[22px] text-white">
                {category.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RestaurantInfo({
  page,
  lightTheme,
  onContactClick,
}: {
  page: PublicMenuPageResponse;
  lightTheme: boolean;
  onContactClick: (contactType: AnalyticsContactType) => void;
}) {
  const establishment = page.establishment;
  const open = isOpenNow(establishment.operatingHours);
  const address = formatAddress(establishment.address);
  return (
    <div
      className={`no-scrollbar h-full overflow-y-auto pb-28 ${lightTheme ? 'bg-cream text-ink' : 'bg-ink text-white'}`}
    >
      {establishment.coverImage ? (
        <FoodImage src={establishment.coverImage.url} alt="" className="h-44 w-full" />
      ) : (
        <div className="h-44 bg-sand" />
      )}
      <div className="px-5">
        <div
          className={`relative z-10 -mt-11 flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-2xl shadow-[0_10px_28px_-10px_rgba(24,23,22,.55)] ring-4 ${lightTheme ? 'bg-ink text-cream ring-cream' : 'bg-cream text-ink ring-ink'}`}
        >
          {establishment.logo ? (
            <FoodImage src={establishment.logo.url} alt="" className="h-full w-full" />
          ) : (
            <span className="font-serif text-4xl">{establishment.name.slice(0, 1)}</span>
          )}
        </div>
        <h1 className="mt-4 font-serif text-[34px] leading-none">{establishment.name}</h1>
        <span
          className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${open ? 'bg-herb/10 text-herb' : lightTheme ? 'bg-ink/5 text-ink-soft' : 'bg-white/10 text-white/75'}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-herb' : 'bg-ink-faint'}`} />
          {open ? 'Aberto agora' : 'Fechado agora'}
        </span>
        {establishment.description ? (
          <p
            className={`mt-4 text-[15px] leading-relaxed ${lightTheme ? 'text-ink-soft' : 'text-white/70'}`}
          >
            {establishment.description}
          </p>
        ) : null}
        <div className="mt-7">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 size={16} className="text-[var(--menu-primary-deep)]" />
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}`}
            >
              Horário de funcionamento
            </span>
          </div>
          <ul
            className={`divide-y border-y ${lightTheme ? 'divide-line border-line' : 'divide-white/10 border-white/10'}`}
          >
            {PUBLIC_DAYS.map(({ key, label }) => {
              const hours = establishment.operatingHours[key];
              return (
                <li key={key} className="flex items-center justify-between py-2.5 text-[15px]">
                  <span className={lightTheme ? 'text-ink-soft' : 'text-white/[0.65]'}>
                    {label}
                  </span>
                  <span className="font-medium">
                    {!hours
                      ? 'Não configurado'
                      : hours.closed
                        ? 'Fechado'
                        : `${hours.open} – ${hours.close}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        {address ? (
          <div className="mt-7">
            <div className="mb-2 flex items-center gap-2">
              <MapPin size={16} className="text-[var(--menu-primary-deep)]" />
              <span
                className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}`}
              >
                Endereço
              </span>
            </div>
            <p className={`text-[15px] ${lightTheme ? 'text-ink-soft' : 'text-white/70'}`}>
              {address}
            </p>
          </div>
        ) : null}
        {establishment.phone || establishment.whatsapp ? (
          <div className="mt-7">
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}`}
            >
              Contato
            </span>
            <ul className="mt-3 flex flex-col gap-2">
              {establishment.phone ? (
                <li
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-[15px] ${lightTheme ? 'bg-sand' : 'bg-white/[0.08]'}`}
                >
                  <a
                    className="flex w-full items-center justify-between gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--menu-primary)]"
                    href={createPhoneHref(establishment.phone)}
                    onClick={() => onContactClick('phone')}
                  >
                    <span className={lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}>
                      Telefone
                    </span>
                    <span className="font-medium">{establishment.phone}</span>
                  </a>
                </li>
              ) : null}
              {establishment.whatsapp ? (
                <li
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-[15px] ${lightTheme ? 'bg-sand' : 'bg-white/[0.08]'}`}
                >
                  <a
                    className="flex w-full items-center justify-between gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--menu-primary)]"
                    href={createWhatsAppHref(establishment.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onContactClick('whatsapp')}
                  >
                    <span className={lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}>
                      WhatsApp
                    </span>
                    <span className="font-medium">{establishment.whatsapp}</span>
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BottomNav({
  active,
  overlay,
  lightTheme,
  onChange,
}: {
  active: CustomerTab;
  overlay: boolean;
  lightTheme: boolean;
  onChange: (tab: CustomerTab) => void;
}) {
  const items = [
    { id: 'menu' as const, label: 'Menu', icon: UtensilsCrossed },
    { id: 'categories' as const, label: 'Categorias', icon: LayoutGrid },
    { id: 'restaurant' as const, label: 'Restaurante', icon: Store },
  ];
  return (
    <nav
      className={`absolute inset-x-0 bottom-0 z-20 flex items-stretch justify-around px-2 pb-3 pt-2 ${overlay ? 'bg-gradient-to-t from-black/60 to-transparent' : lightTheme ? 'border-t border-line bg-cream/95 text-ink backdrop-blur' : 'border-t border-white/10 bg-ink/95 text-white backdrop-blur'}`}
      aria-label="Navegação do cardápio"
    >
      {items.map((item) => {
        const selected = item.id === active;
        const Icon = item.icon;
        const color = overlay
          ? selected
            ? 'text-white'
            : 'text-white/[0.55]'
          : selected
            ? lightTheme
              ? 'text-[var(--menu-primary-deep)]'
              : 'text-[var(--menu-primary)]'
            : lightTheme
              ? 'text-ink-faint'
              : 'text-white/[0.55]';
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={selected ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition ${color}`}
          >
            <Icon size={22} strokeWidth={selected ? 2.2 : 1.8} />
            <span className={`text-[11px] ${selected ? 'font-semibold' : 'font-medium'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
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
      className={`shrink-0 snap-start rounded-full px-3.5 py-1.5 text-sm font-medium backdrop-blur-md transition-all duration-150 active:scale-95 ${active ? 'bg-white text-[var(--menu-primary-deep)] shadow-sm' : 'bg-white/15 text-white/90 hover:bg-white/25'}`}
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
  categoryName,
  active,
  near,
  lightTheme,
  showHint,
  onOpenDetails,
  onOpenShare,
  onInteraction,
}: {
  product: PublicMenuProductResponse;
  categoryName: string;
  active: boolean;
  near: boolean;
  lightTheme: boolean;
  showHint: boolean;
  onOpenDetails: () => void;
  onOpenShare: () => void;
  onInteraction: (interactionType: AnalyticsInteractionType) => void;
}) {
  return (
    <article
      className="snap-item relative h-full w-full flex-shrink-0 overflow-hidden bg-ink [contain-intrinsic-size:100dvh] [content-visibility:auto]"
      data-product-id={product.id}
      aria-labelledby={`product-title-${product.id}`}
    >
      <div
        className={`absolute inset-0 origin-center transition-transform duration-500 ${active ? 'scale-[1.06]' : 'scale-100'}`}
      >
        <MediaGallery
          product={product}
          active={active}
          loadMedia={near}
          lightTheme={lightTheme}
          onInteraction={onInteraction}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/[0.45] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
      <div
        className={`absolute inset-x-0 bottom-0 z-10 px-5 pb-28 pt-10 text-left text-white transition duration-300 ${active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-60'}`}
      >
        <button type="button" onClick={onOpenDetails} className="block w-full text-left">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
            {categoryName}
          </span>
          <h2
            id={`product-title-${product.id}`}
            className="font-serif text-[34px] leading-[1.05] text-white"
          >
            {product.name}
          </h2>
          {product.description ? (
            <span className="mt-2 block line-clamp-2 max-w-[310px] text-[15px] leading-snug text-white/[0.85]">
              {product.description}
            </span>
          ) : null}
        </button>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              {product.promotionalPrice ? (
                <>
                  <span className="tnum rounded-full bg-white px-3.5 py-1.5 text-[15px] font-semibold text-ink">
                    {formatMoney(product.promotionalPrice)}
                  </span>
                  <span className="text-xs text-white/[0.65] line-through">
                    {formatMoney(product.price)}
                  </span>
                </>
              ) : (
                <span className="tnum rounded-full bg-white px-3.5 py-1.5 text-[15px] font-semibold text-ink">
                  {formatMoney(product.price)}
                </span>
              )}
              <button
                type="button"
                onClick={onOpenDetails}
                className="rounded-md text-sm font-medium text-white/75 transition-colors hover:text-white"
              >
                Ver detalhes →
              </button>
            </div>
            {product.featured || product.availability === 'TEMPORARILY_UNAVAILABLE' ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {product.featured ? (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                    Destaque da casa
                  </span>
                ) : null}
                {product.availability === 'TEMPORARILY_UNAVAILABLE' ? (
                  <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
                    Indisponível hoje
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <ProductShareButton productName={product.name} onClick={onOpenShare} />
        </div>
      </div>
      {showHint ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 text-white/70">
          <ChevronsDown size={26} strokeWidth={1.75} />
        </div>
      ) : null}
    </article>
  );
}

function MediaGallery({
  product,
  active,
  loadMedia,
  lightTheme,
  compact = false,
  onInteraction,
}: {
  product: PublicMenuProductResponse;
  active: boolean;
  loadMedia: boolean;
  lightTheme: boolean;
  compact?: boolean;
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
        className={`grid h-full place-items-center px-8 text-center text-sm ${lightTheme ? 'bg-sand text-ink-faint' : 'bg-ink-soft text-white/[0.55]'}`}
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
              <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
      {media.length > 1 && (
        <div
          className={`absolute left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full px-2 py-1 ${compact ? 'bottom-3' : 'bottom-28'} ${lightTheme ? 'bg-white/80' : 'bg-black/[0.55]'}`}
        >
          {media.map((item, index) => (
            <button
              className={`h-1.5 rounded-full transition-all ${
                index === selectedMedia
                  ? 'w-5 bg-[var(--menu-primary)]'
                  : lightTheme
                    ? 'w-1.5 bg-ink/30'
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
      {!compact && media.length > 1 ? (
        <p className="absolute bottom-5 left-5 z-10 text-xs text-white/70">
          Deslize para ver mais mídias
        </p>
      ) : null}
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
        className={`absolute right-5 top-16 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur ${lightTheme ? 'border-ink/15 bg-white/[0.85] text-ink' : 'border-white/30 bg-black/[0.55] text-white'}`}
        type="button"
        aria-label={muted ? 'Ativar som do vídeo' : 'Desativar som do vídeo'}
        aria-pressed={!muted}
        onClick={() => {
          onInteraction();
          setMuted((value) => !value);
        }}
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
    </>
  );
}

function ProductDetails({
  product,
  categoryName,
  lightTheme,
  onInteraction,
  onClose,
}: {
  product: PublicMenuProductResponse;
  categoryName: string;
  lightTheme: boolean;
  onInteraction: (interactionType: AnalyticsInteractionType) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const dragStart = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  useModalDialog(true, dialogRef, onClose);

  return (
    <div className="absolute inset-0 z-40" role="presentation">
      <button
        type="button"
        aria-label="Fechar detalhes"
        className="absolute inset-0 bg-black/[0.45] transition-opacity duration-300"
        style={{ opacity: Math.max(0, 1 - dragY / 420) }}
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className={`absolute inset-x-0 bottom-0 max-h-[88%] overflow-hidden rounded-t-[24px] ${dragging ? '' : 'transition-transform duration-300 ease-out'} ${lightTheme ? 'bg-cream text-ink' : 'bg-ink text-white'}`}
        style={{ transform: `translateY(${dragY}px)` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-details-title"
      >
        <div className="no-scrollbar max-h-[88dvh] overflow-y-auto">
          <div className="relative h-56 w-full bg-sand">
            <div
              className="absolute inset-x-0 top-0 z-20 h-10 touch-none"
              onPointerDown={(event) => {
                dragStart.current = event.clientY;
                setDragging(true);
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (dragging) setDragY(Math.max(0, event.clientY - dragStart.current));
              }}
              onPointerUp={() => {
                setDragging(false);
                if (dragY > 130) onClose();
                else setDragY(0);
              }}
              onPointerCancel={() => {
                setDragging(false);
                setDragY(0);
              }}
            />
            <MediaGallery
              product={product}
              active
              loadMedia
              lightTheme={lightTheme}
              compact
              onInteraction={onInteraction}
            />
            <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-white/75" />
            <button
              type="button"
              data-dialog-initial-focus
              aria-label="Fechar"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink backdrop-blur"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-5 pb-8 pt-5">
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}`}
            >
              {categoryName}
            </span>
            <div className="mt-1 flex items-start justify-between gap-4">
              <h2 id="product-details-title" className="font-serif text-[30px] leading-tight">
                {product.name}
              </h2>
              <div className="tnum whitespace-nowrap pt-2 text-right text-[20px] font-semibold text-[var(--menu-primary-deep)]">
                {formatMoney(product.promotionalPrice ?? product.price)}
                {product.promotionalPrice ? (
                  <span
                    className={`block text-xs font-normal line-through ${lightTheme ? 'text-ink-faint' : 'text-white/[0.45]'}`}
                  >
                    {formatMoney(product.price)}
                  </span>
                ) : null}
              </div>
            </div>
            {product.description ? (
              <p
                className={`mt-3 text-[15px] leading-relaxed ${lightTheme ? 'text-ink-soft' : 'text-white/70'}`}
              >
                {product.description}
              </p>
            ) : null}
            {product.ingredients ? (
              <div className="mt-6">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}`}
                >
                  Ingredientes
                </span>
                <p className="mt-2 text-[15px] leading-relaxed">{product.ingredients}</p>
              </div>
            ) : null}
            {product.allergens ? (
              <div className="mt-6">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${lightTheme ? 'text-ink-faint' : 'text-white/[0.55]'}`}
                >
                  Alergênicos
                </span>
                <div
                  className={`mt-2 inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium ${lightTheme ? 'border-line bg-white/60 text-ink-soft' : 'border-white/15 text-white/70'}`}
                >
                  {product.allergens}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={`mt-8 w-full rounded-xl py-3.5 text-[15px] font-medium transition active:scale-[0.99] ${lightTheme ? 'bg-ink text-white' : 'bg-cream text-ink'}`}
            >
              Voltar ao menu
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PublicMenuLoading() {
  return (
    <main className="min-h-[100dvh] bg-sand sm:grid sm:place-items-center sm:p-6">
      <div
        className="h-[100dvh] w-full overflow-hidden bg-cream sm:h-[812px] sm:w-[390px] sm:rounded-[36px] sm:ring-1 sm:ring-black/10 sm:shadow-[0_40px_80px_-30px_rgba(24,23,22,.45)]"
        role="status"
        aria-busy="true"
        aria-label="Carregando cardápio"
      >
        <Skeleton className="h-[46%] w-full rounded-none" />
        <div className="relative -mt-12 flex flex-col items-center gap-3 px-6">
          <Skeleton className="h-24 w-24 rounded-3xl" />
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-4 h-12 w-48 rounded-full" />
        </div>
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
    <main className="grid min-h-[100dvh] place-items-center bg-cream px-8 text-center text-ink">
      <div className="max-w-sm">
        <div className="mx-auto mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink font-serif text-xl text-cream">
            P
          </span>
          <span className="text-lg font-semibold tracking-tight">PRATTO</span>
        </div>
        <div className="mx-auto mb-5 h-px w-12 bg-line" />
        <h1 className="font-serif text-[30px] leading-tight">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{message}</p>
        {retryable && onRetry && (
          <button
            className="mt-6 rounded-xl bg-accent-deep px-5 py-3 text-sm font-medium text-white hover:bg-ink"
            type="button"
            onClick={onRetry}
          >
            Tentar novamente
          </button>
        )}
        {(notPublished || suspended || notFound) && (
          <p className="mt-10 text-xs uppercase tracking-[0.2em] text-ink-faint">
            Menus digitais por PRATTO
          </p>
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
      className={`grid h-full place-items-center px-6 text-center ${lightTheme ? 'bg-cream text-ink' : 'bg-ink text-white'}`}
    >
      <div className="max-w-md space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--menu-primary-deep)]">
          Pratto
        </p>
        <h2 className="font-serif text-[32px] leading-tight">Nenhum prato disponível</h2>
        <p className={`text-sm leading-6 ${lightTheme ? 'text-ink-soft' : 'text-white/[0.65]'}`}>
          {categorySelected
            ? 'Não há produtos publicados nesta categoria.'
            : 'Este cardápio ainda não possui produtos publicados.'}
        </p>
        {categorySelected && (
          <button
            className={`rounded-xl border px-5 py-3 text-sm font-medium ${lightTheme ? 'border-line' : 'border-white/20'}`}
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
      className={`snap-item grid h-full flex-shrink-0 place-items-center text-sm ${lightTheme ? 'bg-cream text-ink-faint' : 'bg-ink text-white/[0.55]'}`}
      role="status"
    >
      Carregando mais produtos…
    </div>
  );
}

function FeedError({ lightTheme, onRetry }: { lightTheme: boolean; onRetry: () => void }) {
  return (
    <div
      className={`grid min-h-24 place-items-center gap-2 px-6 py-5 text-center text-sm ${lightTheme ? 'bg-cream text-ink-soft' : 'bg-ink text-white/70'}`}
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

function darkenColor(value: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return '#c63f25';
  const hex = match[1]!;
  const channels = [0, 2, 4].map((offset) =>
    Math.round(Number.parseInt(hex.slice(offset, offset + 2), 16) * 0.82),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function isOpenNow(hours: PublicMenuPageResponse['establishment']['operatingHours']): boolean {
  const dayKeys = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;
  const current = hours[dayKeys[new Date().getDay()]!];
  if (!current || current.closed || !current.open || !current.close) return false;
  const now = new Date();
  const value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return current.close < current.open
    ? value >= current.open || value < current.close
    : value >= current.open && value < current.close;
}

function formatAddress(address: PublicMenuPageResponse['establishment']['address']): string {
  if (!address) return '';
  const street = [address.street, address.number].filter(Boolean).join(', ');
  const city = [address.neighborhood, address.city, address.state].filter(Boolean).join(' · ');
  return [street, address.complement, city, address.postalCode].filter(Boolean).join(' — ');
}

function createPhoneHref(value: string): string {
  const normalized = normalizePhone(value);
  return `tel:${normalized}`;
}

function createWhatsAppHref(value: string): string {
  return `https://wa.me/${normalizePhone(value).replace(/^\+/, '')}`;
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const prefix = trimmed.startsWith('+') ? '+' : '';
  return `${prefix}${trimmed.replace(/\D/g, '')}`;
}
