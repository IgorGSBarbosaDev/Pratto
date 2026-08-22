'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { CategoryResponse, ProductAvailability, ProductResponse } from '@pratto/contracts';
import { productCreateSchema } from '@pratto/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';

import { ApiClientError } from '../auth/api-client';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FoodImage,
  Skeleton,
} from '../design-system/feedback';
import {
  Button,
  Field,
  SectionLabel,
  Select,
  Textarea,
  TextInput,
  Toggle,
} from '../design-system/primitives';
import { useModalDialog } from '../design-system/use-modal-dialog';

import { catalogApi } from './api-client';
import { ProductMediaManagement } from './product-media-management';

type ProductFormValues = {
  categoryId: string;
  name: string;
  description?: string | null;
  price: string;
  promotionalPrice?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  availability: ProductAvailability;
  featured: boolean;
};

const emptyValues: ProductFormValues = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  promotionalPrice: '',
  ingredients: '',
  allergens: '',
  availability: 'AVAILABLE',
  featured: false,
};
const availabilityLabels: Record<ProductAvailability, string> = {
  AVAILABLE: 'Disponível',
  TEMPORARILY_UNAVAILABLE: 'Indisponível no momento',
  HIDDEN: 'Oculto',
};

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível concluir a solicitação.';
}
function formatMoney(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
    : `R$ ${value}`;
}

export function ProductManagement({
  establishmentId,
  selectedMenuId,
}: {
  establishmentId: string;
  selectedMenuId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [internalMenuId, setInternalMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [archiving, setArchiving] = useState<ProductResponse | null>(null);
  const [queryText, setQueryText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const menuId = selectedMenuId === undefined ? internalMenuId : selectedMenuId;

  const menusQuery = useQuery({
    queryKey: ['catalog-product-menus', establishmentId],
    queryFn: () => catalogApi.listMenusForEstablishment(establishmentId),
  });
  const categoriesQuery = useQuery({
    queryKey: ['catalog-product-categories', establishmentId, menuId ?? 'none'],
    queryFn: () => catalogApi.listCategories(menuId!),
    enabled: menuId !== null,
  });
  const productsQuery = useQuery({
    queryKey: ['catalog-products', establishmentId, menuId ?? 'none'],
    queryFn: () => catalogApi.listProducts(menuId!),
    enabled: menuId !== null,
  });
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productCreateSchema) as unknown as Resolver<ProductFormValues>,
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!menuId || !menusQuery.data) return;
    if (!menusQuery.data.menus.some((menu) => menu.id === menuId)) {
      if (selectedMenuId === undefined) setInternalMenuId(null);
      setEditingId(null);
      setDrawerOpen(false);
    }
  }, [menuId, menusQuery.data, selectedMenuId]);

  const products = useMemo(
    () => productsQuery.data?.products ?? [],
    [productsQuery.data?.products],
  );
  const categories = useMemo(
    () => categoriesQuery.data?.categories ?? [],
    [categoriesQuery.data?.categories],
  );
  const editing = products.find((product) => product.id === editingId) ?? null;
  useEffect(() => {
    form.reset(
      editing
        ? {
            categoryId: editing.categoryId,
            name: editing.name,
            description: editing.description ?? '',
            price: editing.price,
            promotionalPrice: editing.promotionalPrice ?? '',
            ingredients: editing.ingredients ?? '',
            allergens: editing.allergens ?? '',
            availability: editing.availability,
            featured: editing.featured,
          }
        : emptyValues,
    );
  }, [editing, form]);

  const queryKey = ['catalog-products', establishmentId, menuId ?? 'none'] as const;
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const save = useMutation({
    mutationFn: (input: ProductFormValues) => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return editingId
        ? catalogApi.updateProduct(menuId, editingId, input)
        : catalogApi.createProduct(menuId, input);
    },
    onSuccess: async () => {
      setEditingId(null);
      setDrawerOpen(false);
      await invalidate();
    },
  });
  const status = useMutation({
    mutationFn: ({
      product,
      action,
    }: {
      product: ProductResponse;
      action: 'activate' | 'deactivate';
    }) => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return action === 'activate'
        ? catalogApi.activateProduct(menuId, product.id)
        : catalogApi.deactivateProduct(menuId, product.id);
    },
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: (product: ProductResponse) => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return catalogApi.archiveProduct(menuId, product.id);
    },
    onSuccess: async () => {
      setArchiving(null);
      setEditingId(null);
      await invalidate();
    },
  });
  const reorder = useMutation({
    mutationFn: (productIds: string[]) => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return catalogApi.reorderProducts(menuId, { productIds });
    },
    onSuccess: invalidate,
  });

  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          (categoryFilter === 'all' || product.categoryId === categoryFilter) &&
          product.name
            .toLocaleLowerCase('pt-BR')
            .includes(queryText.trim().toLocaleLowerCase('pt-BR')),
      ),
    [categoryFilter, products, queryText],
  );
  const visible = products.filter((product) => !product.archivedAt);
  const busy = save.isPending || status.isPending || archive.isPending || reorder.isPending;
  const move = (product: ProductResponse, direction: -1 | 1) => {
    const index = visible.findIndex((item) => item.id === product.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= visible.length) return;
    const next = visible.map((item) => item.id);
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorder.mutate(next);
  };

  if (menusQuery.isPending) return <ProductLoading />;
  if (menusQuery.error || !menusQuery.data)
    return (
      <ErrorState
        description={messageFor(menusQuery.error)}
        onRetry={() => void menusQuery.refetch()}
      />
    );

  return (
    <div className="mx-auto max-w-6xl">
      {selectedMenuId === undefined ? (
        <section className="pratto-panel mb-6 p-5">
          <label className="pratto-label" htmlFor="product-menu-target">
            Menu alvo dos produtos
            <Select
              id="product-menu-target"
              className="mt-1"
              value={menuId ?? ''}
              onChange={(event) => {
                setInternalMenuId(event.target.value || null);
                setEditingId(null);
                setDrawerOpen(false);
              }}
            >
              <option value="">Selecione um menu</option>
              {menusQuery.data.menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name} ({menu.status === 'ACTIVE' ? 'ativo' : 'rascunho'})
                </option>
              ))}
            </Select>
          </label>
          {!menuId && menusQuery.data.menus.length > 0 ? (
            <p className="mt-3 pratto-help">
              Selecione explicitamente o menu que deseja gerenciar.
            </p>
          ) : null}
        </section>
      ) : null}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>
            {visible.length} pratos · {categories.filter((category) => !category.archivedAt).length}{' '}
            categorias
          </SectionLabel>
          <h1 className="mt-1 pratto-page-title">Pratos</h1>
        </div>
        <Button
          disabled={!menuId}
          onClick={() => {
            setEditingId(null);
            form.reset(emptyValues);
            setDrawerOpen(true);
          }}
        >
          <Plus size={18} /> Novo prato
        </Button>
      </header>

      {!menuId ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Escolha um menu"
          description="O menu alvo precisa ser selecionado antes de consultar ou alterar pratos."
        />
      ) : productsQuery.isPending || categoriesQuery.isPending ? (
        <ProductTableSkeleton />
      ) : productsQuery.error || categoriesQuery.error || !productsQuery.data ? (
        <ErrorState
          description={messageFor(productsQuery.error ?? categoriesQuery.error)}
          onRetry={() => {
            void productsQuery.refetch();
            void categoriesQuery.refetch();
          }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                className="pratto-input pl-10"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                placeholder="Buscar pratos…"
                aria-label="Buscar pratos"
              />
            </div>
            <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto">
              {[
                { id: 'all', name: 'Todas' },
                ...categories.filter((category) => !category.archivedAt),
              ].map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={categoryFilter === category.id}
                  onClick={() => setCategoryFilter(category.id)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${categoryFilter === category.id ? 'bg-ink text-white' : 'border border-line text-ink-soft hover:bg-cream'}`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          <section className="overflow-hidden rounded-2xl border border-line bg-cream">
            {products.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="Nenhum produto cadastrado."
                description="Crie o primeiro prato para começar a montar o cardápio."
                action={
                  <Button onClick={() => setDrawerOpen(true)}>
                    <Plus size={17} /> Criar prato
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                compact
                icon={Search}
                title="Nenhum prato encontrado"
                description="Ajuste a busca ou escolha outra categoria."
              />
            ) : (
              <div
                className="overflow-x-auto overscroll-x-contain rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                role="region"
                aria-label="Tabela de pratos"
                tabIndex={0}
              >
                <div className="min-w-[880px]">
                  <div className="grid grid-cols-[52px_1fr_150px_120px_120px_120px] gap-4 border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                    <span />
                    <span>Prato</span>
                    <span>Categoria</span>
                    <span className="text-right">Preço</span>
                    <span className="text-center">Ativo</span>
                    <span className="text-right">Ações</span>
                  </div>
                  <div className="divide-y divide-line">
                    {filtered.map((product) => {
                      const category = categories.find((item) => item.id === product.categoryId);
                      const archived = Boolean(product.archivedAt);
                      const index = visible.findIndex((item) => item.id === product.id);
                      return (
                        <div
                          key={product.id}
                          className={`grid grid-cols-[52px_1fr_150px_120px_120px_120px] items-center gap-4 px-4 py-3 transition hover:bg-sand/45 ${archived ? 'opacity-55' : ''}`}
                        >
                          <div className="flex items-center text-ink-faint">
                            <GripVertical size={17} />
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  archived ||
                                  categoryFilter !== 'all' ||
                                  Boolean(queryText) ||
                                  index === 0
                                }
                                aria-label={`Mover ${product.name} para cima`}
                                onClick={() => move(product, -1)}
                                className="rounded hover:bg-sand disabled:opacity-25"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  archived ||
                                  categoryFilter !== 'all' ||
                                  Boolean(queryText) ||
                                  index === visible.length - 1
                                }
                                aria-label={`Mover ${product.name} para baixo`}
                                onClick={() => move(product, 1)}
                                className="rounded hover:bg-sand disabled:opacity-25"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center gap-3">
                            <ProductThumbnail menuId={menuId} product={product} />
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-medium text-ink">
                                {product.name}
                              </p>
                              <p className="truncate text-sm text-ink-faint">
                                {product.description || availabilityLabels[product.availability]}
                              </p>
                            </div>
                          </div>
                          <span className="truncate text-sm text-ink-soft">
                            {category?.name ?? 'Sem categoria'}
                          </span>
                          <div className="text-right">
                            <p className="tnum text-[15px] font-semibold text-ink">
                              {formatMoney(product.promotionalPrice ?? product.price)}
                            </p>
                            {product.promotionalPrice ? (
                              <p className="tnum text-xs text-ink-faint line-through">
                                {formatMoney(product.price)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex justify-center">
                            <Toggle
                              on={!archived && product.status === 'ACTIVE'}
                              disabled={busy || archived}
                              ariaLabel={`Produto ${product.name} ativo`}
                              onToggle={() =>
                                status.mutate({
                                  product,
                                  action: product.status === 'ACTIVE' ? 'deactivate' : 'activate',
                                })
                              }
                            />
                          </div>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={busy || archived}
                              onClick={() => {
                                setEditingId(product.id);
                                setDrawerOpen(true);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition hover:bg-sand-deep hover:text-ink"
                              aria-label={`Editar ${product.name}`}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={busy || archived}
                              onClick={() => {
                                setEditingId(product.id);
                                setDrawerOpen(true);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition hover:bg-sand-deep hover:text-ink"
                              aria-label={`Gerenciar mídias de ${product.name}`}
                            >
                              <ImagePlus size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={busy || archived}
                              onClick={() => setArchiving(product)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition hover:bg-accent/10 hover:text-accent-deep"
                              aria-label={`Arquivar ${product.name}`}
                            >
                              <Archive size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
          {status.error || archive.error || reorder.error ? (
            <p className="mt-4 pratto-error" role="alert">
              {messageFor(status.error ?? archive.error ?? reorder.error)}
            </p>
          ) : null}
        </>
      )}

      <ProductDrawer
        open={drawerOpen}
        editing={editing}
        menuId={menuId}
        categories={categories}
        form={form}
        saving={save.isPending}
        saveError={save.error}
        onClose={() => {
          if (!save.isPending) {
            setDrawerOpen(false);
            setEditingId(null);
          }
        }}
        onSubmit={(values) => save.mutate(values)}
      />
      <ArchiveProductDialog
        product={archiving}
        pending={archive.isPending}
        onCancel={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) archive.mutate(archiving);
        }}
      />
    </div>
  );
}

function ProductDrawer({
  open,
  editing,
  menuId,
  categories,
  form,
  saving,
  saveError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: ProductResponse | null;
  menuId: string | null;
  categories: CategoryResponse[];
  form: ReturnType<typeof useForm<ProductFormValues>>;
  saving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useModalDialog(open, dialogRef, onClose);
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Fechar formulário"
        onClick={onClose}
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-drawer-title"
        className={`absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col bg-cream shadow-[-24px_0_60px_-30px_rgba(24,23,22,0.5)] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 id="product-drawer-title" className="font-serif text-[24px] leading-tight text-ink">
              {editing ? 'Editar prato' : 'Novo prato'}
            </h2>
            <p className="mt-0.5 text-sm text-ink-faint">
              {editing ? editing.name : 'Adicione um prato ao seu cardápio'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            data-dialog-initial-focus
            onClick={onClose}
            disabled={saving}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-sand"
          >
            <X size={18} />
          </button>
        </header>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="no-scrollbar flex-1 space-y-7 overflow-y-auto px-6 py-5">
            <section>
              <SectionLabel>Mídia</SectionLabel>
              <div className="mt-2">
                {editing && menuId ? (
                  <ProductMediaManagement menuId={menuId} productId={editing.id} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-line bg-sand/35 px-5 py-8 text-center">
                    <ImagePlus className="mx-auto text-ink-faint" size={24} />
                    <p className="mt-2 text-sm font-medium text-ink">
                      Salve o prato para adicionar mídias
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Depois você poderá enviar imagens e vídeos, ordenar e escolher a mídia
                      principal.
                    </p>
                  </div>
                )}
              </div>
            </section>
            <section className="space-y-4">
              <SectionLabel>Informações básicas</SectionLabel>
              <Field label="Nome do prato" required error={form.formState.errors.name?.message}>
                <TextInput
                  invalid={Boolean(form.formState.errors.name)}
                  placeholder="Ex.: Smash Bacon"
                  {...form.register('name')}
                />
              </Field>
              <Field
                label="Descrição"
                error={form.formState.errors.description?.message}
                hint="Usada no feed e na ficha detalhada."
              >
                <Textarea
                  rows={4}
                  placeholder="Ingredientes, preparo e o que torna o prato especial."
                  {...form.register('description')}
                />
              </Field>
            </section>
            <section className="space-y-4">
              <SectionLabel>Informações do menu</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (R$)" required error={form.formState.errors.price?.message}>
                  <TextInput
                    inputMode="decimal"
                    invalid={Boolean(form.formState.errors.price)}
                    placeholder="38,90"
                    {...form.register('price')}
                  />
                </Field>
                <Field
                  label="Preço promocional"
                  error={form.formState.errors.promotionalPrice?.message}
                >
                  <TextInput
                    inputMode="decimal"
                    placeholder="Opcional"
                    {...form.register('promotionalPrice', {
                      setValueAs: (value) => (value === '' ? null : value),
                    })}
                  />
                </Field>
              </div>
              <Field label="Categoria" required error={form.formState.errors.categoryId?.message}>
                <Select
                  invalid={Boolean(form.formState.errors.categoryId)}
                  {...form.register('categoryId')}
                >
                  <option value="">Selecione</option>
                  {categories
                    .filter((category) => !category.archivedAt)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </section>
            <section className="space-y-4">
              <SectionLabel>Ingredientes e informações</SectionLabel>
              <Field label="Ingredientes">
                <Textarea
                  rows={3}
                  placeholder="Liste os ingredientes principais."
                  {...form.register('ingredients')}
                />
              </Field>
              <Field label="Alergênicos">
                <Textarea
                  rows={2}
                  placeholder="Ex.: contém leite e castanhas."
                  {...form.register('allergens')}
                />
              </Field>
            </section>
            <section className="space-y-3">
              <SectionLabel>Disponibilidade</SectionLabel>
              <Field label="Estado no menu">
                <Select {...form.register('availability')}>
                  {Object.entries(availabilityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center justify-between rounded-xl bg-sand px-4 py-3">
                <span>
                  <span className="block text-[15px] font-medium text-ink">Prato em destaque</span>
                  <span className="block text-sm text-ink-faint">
                    Ajuda a priorizar o item na experiência pública.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--color-herb)]"
                  {...form.register('featured')}
                />
              </label>
            </section>
            {saveError ? (
              <p className="pratto-error" role="alert">
                {messageFor(saveError)}
              </p>
            ) : null}
          </div>
          <footer className="flex justify-end gap-3 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar prato'}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ArchiveProductDialog({
  product,
  pending,
  onConfirm,
  onCancel,
}: {
  product: ProductResponse | null;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={Boolean(product)}
      title="Arquivar prato?"
      description={
        product
          ? `“${product.name}” deixará o catálogo editável. Publicações anteriores permanecem imutáveis.`
          : ''
      }
      confirmLabel="Arquivar"
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function ProductThumbnail({ menuId, product }: { menuId: string; product: ProductResponse }) {
  const mediaQuery = useQuery({
    queryKey: ['catalog-product-media', menuId, product.id],
    queryFn: () => catalogApi.listProductMedia(menuId, product.id),
    staleTime: 30_000,
  });
  const media = mediaQuery.data?.media.find((item) => item.isPrimary) ?? mediaQuery.data?.media[0];
  if (media?.mediaType === 'IMAGE') {
    return (
      <FoodImage
        src={media.url}
        alt=""
        className="h-11 w-11 shrink-0 rounded-xl"
        imgClassName="object-cover"
      />
    );
  }
  return (
    <div
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sand text-ink-faint"
      aria-hidden="true"
    >
      {media?.mediaType === 'VIDEO' ? (
        <ImagePlus size={18} strokeWidth={1.7} />
      ) : (
        <UtensilsCrossed size={18} strokeWidth={1.7} />
      )}
    </div>
  );
}

function ProductLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" role="status">
      <Skeleton className="h-10 w-44" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
function ProductTableSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando produtos">
      <Skeleton className="h-11 rounded-xl" />
      {Array.from({ length: 7 }, (_, index) => (
        <Skeleton key={index} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
