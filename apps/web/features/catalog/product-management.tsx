'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ProductAvailability, ProductResponse } from '@pratto/contracts';
import type { CategoryResponse } from '@pratto/contracts';
import { productCreateSchema } from '@pratto/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';

import { ApiClientError } from '../auth/api-client';

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

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível concluir a solicitação.';
}

const availabilityLabels: Record<ProductAvailability, string> = {
  AVAILABLE: 'Disponível',
  TEMPORARILY_UNAVAILABLE: 'Temporariamente indisponível',
  HIDDEN: 'Oculto',
};

export function ProductManagement({ establishmentId }: { establishmentId: string }) {
  const queryClient = useQueryClient();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mediaProductId, setMediaProductId] = useState<string | null>(null);
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
    defaultValues: {
      categoryId: '',
      name: '',
      description: '',
      price: '',
      promotionalPrice: '',
      ingredients: '',
      allergens: '',
      availability: 'AVAILABLE',
      featured: false,
    },
  });

  useEffect(() => {
    if (!menuId || !menusQuery.data) return;
    if (!menusQuery.data.menus.some((menu) => menu.id === menuId)) {
      setMenuId(null);
      setEditingId(null);
      setMediaProductId(null);
    }
  }, [menuId, menusQuery.data]);

  const products = productsQuery.data?.products ?? [];
  const categories = categoriesQuery.data?.categories ?? [];
  const editing = products.find((product) => product.id === editingId) ?? null;
  useEffect(() => {
    form.reset({
      categoryId: editing?.categoryId ?? '',
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      price: editing?.price ?? '',
      promotionalPrice: editing?.promotionalPrice ?? '',
      ingredients: editing?.ingredients ?? '',
      allergens: editing?.allergens ?? '',
      availability: editing?.availability ?? 'AVAILABLE',
      featured: editing?.featured ?? false,
    });
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

  if (menusQuery.isPending) {
    return (
      <p role="status" className="text-sm text-slate-400">
        Carregando menus…
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <label className="block text-sm font-medium" htmlFor="product-menu-target">
          Menu alvo dos produtos
          <select
            id="product-menu-target"
            className={inputClass}
            value={menuId ?? ''}
            onChange={(event) => {
              setMenuId(event.target.value || null);
              setEditingId(null);
              setMediaProductId(null);
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
        {!menuId && menusQuery.data.menus.length > 0 && (
          <p className="mt-3 text-sm text-slate-400">
            Selecione explicitamente o menu que deseja gerenciar.
          </p>
        )}
      </section>

      {!menuId ? null : productsQuery.isPending || categoriesQuery.isPending ? (
        <p role="status" className="text-sm text-slate-400">
          Carregando produtos…
        </p>
      ) : productsQuery.error || categoriesQuery.error || !productsQuery.data ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200"
        >
          {messageFor(productsQuery.error ?? categoriesQuery.error)}
        </div>
      ) : (
        <ProductEditor
          categories={categories}
          products={products}
          editing={editing}
          form={form}
          isBusy={save.isPending || status.isPending || archive.isPending || reorder.isPending}
          saveError={save.error}
          statusError={status.error}
          archiveError={archive.error}
          reorderError={reorder.error}
          onArchive={(product) => archive.mutate(product)}
          onEdit={(product) => setEditingId(product.id)}
          mediaProductId={mediaProductId}
          onToggleMedia={(product) =>
            setMediaProductId((current) => (current === product.id ? null : product.id))
          }
          onMove={(product, direction) => {
            const visibleProducts = products.filter((item) => !item.archivedAt);
            const currentIndex = visibleProducts.findIndex((item) => item.id === product.id);
            const targetIndex = currentIndex + direction;
            if (currentIndex < 0 || targetIndex < 0 || targetIndex >= visibleProducts.length)
              return;
            const next = visibleProducts.map((item) => item.id);
            [next[currentIndex], next[targetIndex]] = [next[targetIndex]!, next[currentIndex]!];
            reorder.mutate(next);
          }}
          onSubmit={(values) => save.mutate(values)}
          onToggle={(product) =>
            status.mutate({
              product,
              action: product.status === 'ACTIVE' ? 'deactivate' : 'activate',
            })
          }
          onCancelEdit={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function ProductEditor({
  categories,
  products,
  editing,
  form,
  isBusy,
  saveError,
  statusError,
  archiveError,
  reorderError,
  onArchive,
  onEdit,
  mediaProductId,
  onToggleMedia,
  onMove,
  onSubmit,
  onToggle,
  onCancelEdit,
}: {
  categories: CategoryResponse[];
  products: ProductResponse[];
  editing: ProductResponse | null;
  form: ReturnType<typeof useForm<ProductFormValues>>;
  isBusy: boolean;
  saveError: unknown;
  statusError: unknown;
  archiveError: unknown;
  reorderError: unknown;
  onArchive: (product: ProductResponse) => void;
  onEdit: (product: ProductResponse) => void;
  mediaProductId: string | null;
  onToggleMedia: (product: ProductResponse) => void;
  onMove: (product: ProductResponse, direction: -1 | 1) => void;
  onSubmit: (values: ProductFormValues) => void;
  onToggle: (product: ProductResponse) => void;
  onCancelEdit: () => void;
}) {
  const visibleProducts = products.filter((product) => !product.archivedAt);
  const selectableCategories = categories.filter(
    (category) => !category.archivedAt || category.id === editing?.categoryId,
  );

  return (
    <div className="space-y-6">
      <form
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{editing ? 'Editar produto' : 'Novo produto'}</h3>
            <p className="mt-1 text-sm text-slate-400">
              Produtos pertencem ao catálogo editável e só aparecem em uma nova publicação.
            </p>
          </div>
          {editing && (
            <button
              className="text-sm text-slate-400 hover:text-white"
              type="button"
              onClick={onCancelEdit}
            >
              Cancelar edição
            </button>
          )}
        </div>
        {selectableCategories.length === 0 ? (
          <p className="mt-5 rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
            Crie ao menos uma categoria não arquivada antes de cadastrar produtos.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Categoria
              <select className={inputClass} {...form.register('categoryId')}>
                <option value="">Selecione uma categoria</option>
                {selectableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.archivedAt ? ' (arquivada)' : ''}
                  </option>
                ))}
              </select>
              <FieldError message={form.formState.errors.categoryId?.message} />
            </label>
            <label className="text-sm">
              Nome
              <input className={inputClass} {...form.register('name')} />
              <FieldError message={form.formState.errors.name?.message} />
            </label>
            <label className="text-sm">
              Preço (ex.: 19.90)
              <input className={inputClass} inputMode="decimal" {...form.register('price')} />
              <FieldError message={form.formState.errors.price?.message} />
            </label>
            <label className="text-sm">
              Preço promocional opcional
              <input
                className={inputClass}
                inputMode="decimal"
                {...form.register('promotionalPrice')}
              />
              <FieldError message={form.formState.errors.promotionalPrice?.message} />
            </label>
            <label className="text-sm">
              Disponibilidade
              <select className={inputClass} {...form.register('availability')}>
                {Object.entries(availabilityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-7 flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('featured')} />
              Produto em destaque
            </label>
            <label className="text-sm md:col-span-2">
              Descrição
              <textarea className={inputClass} rows={3} {...form.register('description')} />
              <FieldError message={form.formState.errors.description?.message} />
            </label>
            <label className="text-sm">
              Ingredientes
              <textarea className={inputClass} rows={3} {...form.register('ingredients')} />
              <FieldError message={form.formState.errors.ingredients?.message} />
            </label>
            <label className="text-sm">
              Alergênicos
              <textarea className={inputClass} rows={3} {...form.register('allergens')} />
              <FieldError message={form.formState.errors.allergens?.message} />
            </label>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isBusy || selectableCategories.length === 0}
          >
            {isBusy ? 'Salvando…' : editing ? 'Salvar produto' : 'Adicionar produto'}
          </button>
          {Boolean(saveError) && (
            <p className="text-sm text-rose-300" role="alert">
              {messageFor(saveError)}
            </p>
          )}
        </div>
      </form>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Produtos do cardápio</h3>
            <p className="mt-1 text-sm text-slate-400">
              A ordem abaixo será usada no próximo snapshot publicado.
            </p>
          </div>
          <span className="text-sm text-slate-500">
            {visibleProducts.length} produtos editáveis
          </span>
        </div>
        {products.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            Nenhum produto cadastrado.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                category={categories.find((item) => item.id === product.categoryId)}
                index={visibleProducts.findIndex((item) => item.id === product.id)}
                total={visibleProducts.length}
                busy={isBusy}
                onEdit={() => onEdit(product)}
                mediaOpen={mediaProductId === product.id}
                onToggleMedia={() => onToggleMedia(product)}
                onMove={(direction) => onMove(product, direction)}
                onToggle={() => onToggle(product)}
                onArchive={() => onArchive(product)}
              />
            ))}
          </div>
        )}
        {(Boolean(statusError) || Boolean(archiveError) || Boolean(reorderError)) && (
          <p className="mt-4 text-sm text-rose-300" role="alert">
            {messageFor(statusError ?? archiveError ?? reorderError)}
          </p>
        )}
      </section>
    </div>
  );
}

function ProductRow({
  product,
  category,
  index,
  total,
  busy,
  onEdit,
  mediaOpen,
  onToggleMedia,
  onMove,
  onToggle,
  onArchive,
}: {
  product: ProductResponse;
  category: CategoryResponse | undefined;
  index: number;
  total: number;
  busy: boolean;
  onEdit: () => void;
  mediaOpen: boolean;
  onToggleMedia: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  onArchive: () => void;
}) {
  const archived = Boolean(product.archivedAt);
  return (
    <article
      className={`rounded-xl border p-4 ${archived ? 'border-slate-800 bg-slate-950/50 opacity-70' : 'border-slate-800 bg-slate-950'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{product.name}</h4>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              {category?.name ?? 'Categoria indisponível'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${archived ? 'bg-slate-800 text-slate-400' : product.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}
            >
              {archived ? 'Arquivado' : product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            R$ {product.price.replace('.', ',')}
            {product.promotionalPrice && (
              <span className="ml-2 text-emerald-300">
                Promo: R$ {product.promotionalPrice.replace('.', ',')}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {availabilityLabels[product.availability]}
            {product.featured ? ' · Destaque' : ''}
          </p>
          {product.description && (
            <p className="mt-2 text-sm text-slate-400">{product.description}</p>
          )}
        </div>
        {!archived && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-50"
              type="button"
              disabled={busy || index === 0}
              onClick={() => onMove(-1)}
              aria-label={`Mover ${product.name} para cima`}
            >
              ↑
            </button>
            <button
              className="rounded border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-50"
              type="button"
              disabled={busy || index === total - 1}
              onClick={() => onMove(1)}
              aria-label={`Mover ${product.name} para baixo`}
            >
              ↓
            </button>
            <button
              className="rounded border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400"
              type="button"
              onClick={onToggleMedia}
            >
              {mediaOpen ? 'Fechar mídias' : 'Mídias'}
            </button>
            <button
              className="rounded border border-slate-700 px-3 py-1 text-xs hover:border-emerald-400 disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={onEdit}
            >
              Editar
            </button>
            <button
              className="rounded border border-slate-700 px-3 py-1 text-xs hover:border-amber-400 disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={onToggle}
            >
              {product.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
            </button>
            <button
              className="rounded border border-rose-900 px-3 py-1 text-xs text-rose-300 hover:border-rose-500 disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={onArchive}
            >
              Arquivar
            </button>
          </div>
        )}
      </div>
      {mediaOpen && !archived && (
        <ProductMediaManagement menuId={product.menuId} productId={product.id} />
      )}
    </article>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <span className="mt-1 block text-xs text-rose-300">{message}</span> : null;
}
