'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { CategoryResponse } from '@pratto/contracts';
import { categoryCreateSchema } from '@pratto/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LayoutGrid,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';

import { ApiClientError } from '../auth/api-client';
import { EmptyState, ErrorState, Skeleton } from '../design-system/feedback';
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

type CategoryFormValues = { name: string; description?: string | null };

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível concluir a solicitação.';
}

export function CategoryManagement({
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
  const [archiving, setArchiving] = useState<CategoryResponse | null>(null);
  const menuId = selectedMenuId === undefined ? internalMenuId : selectedMenuId;

  const menusQuery = useQuery({
    queryKey: ['catalog-menus', establishmentId],
    queryFn: () => catalogApi.listMenusForEstablishment(establishmentId),
  });
  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories', establishmentId, menuId ?? 'none'],
    queryFn: () => catalogApi.listCategories(menuId!),
    enabled: menuId !== null,
  });
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryCreateSchema) as unknown as Resolver<CategoryFormValues>,
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (!menuId || !menusQuery.data) return;
    if (!menusQuery.data.menus.some((menu) => menu.id === menuId)) {
      if (selectedMenuId === undefined) setInternalMenuId(null);
      setEditingId(null);
      setDrawerOpen(false);
    }
  }, [menuId, menusQuery.data, selectedMenuId]);

  const categories = categoriesQuery.data?.categories ?? [];
  const editing = categories.find((category) => category.id === editingId) ?? null;

  useEffect(() => {
    form.reset({ name: editing?.name ?? '', description: editing?.description ?? '' });
  }, [editing, form]);

  const queryKey = ['catalog-categories', establishmentId, menuId ?? 'none'] as const;
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const save = useMutation({
    mutationFn: (input: CategoryFormValues) => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return editingId
        ? catalogApi.updateCategory(menuId, editingId, input)
        : catalogApi.createCategory(menuId, input);
    },
    onSuccess: async () => {
      setEditingId(null);
      setDrawerOpen(false);
      form.reset({ name: '', description: '' });
      await invalidate();
    },
  });
  const status = useMutation({
    mutationFn: ({
      category,
      action,
    }: {
      category: CategoryResponse;
      action: 'activate' | 'deactivate';
    }) => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return action === 'activate'
        ? catalogApi.activateCategory(menuId, category.id)
        : catalogApi.deactivateCategory(menuId, category.id);
    },
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: (category: CategoryResponse) => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return catalogApi.archiveCategory(menuId, category.id);
    },
    onSuccess: async () => {
      setArchiving(null);
      setEditingId(null);
      await invalidate();
    },
  });
  const reorder = useMutation({
    mutationFn: (categoryIds: string[]) => {
      if (!menuId) throw new Error('Menu não selecionado.');
      return catalogApi.reorderCategories(menuId, { categoryIds });
    },
    onSuccess: invalidate,
  });

  if (menusQuery.isPending) return <CategoryLoading />;
  if (menusQuery.error || !menusQuery.data)
    return (
      <ErrorState
        description={messageFor(menusQuery.error)}
        onRetry={() => void menusQuery.refetch()}
      />
    );

  const busy = save.isPending || status.isPending || archive.isPending || reorder.isPending;
  const visible = categories.filter((category) => !category.archivedAt);
  const mutationError = status.error ?? archive.error ?? reorder.error;

  const move = (category: CategoryResponse, direction: -1 | 1) => {
    const currentIndex = visible.findIndex((item) => item.id === category.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= visible.length) return;
    const next = visible.map((item) => item.id);
    [next[currentIndex], next[targetIndex]] = [next[targetIndex]!, next[currentIndex]!];
    reorder.mutate(next);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {selectedMenuId === undefined ? (
        <section className="pratto-panel mb-6 p-5">
          <label className="pratto-label" htmlFor="catalog-menu-target">
            Menu alvo
            <Select
              id="catalog-menu-target"
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
          {menusQuery.data.menus.length === 0 ? (
            <p className="mt-3 pratto-help">
              Nenhum menu editável está disponível para este estabelecimento.
            </p>
          ) : null}
          {!menuId && menusQuery.data.menus.length > 0 ? (
            <p className="mt-3 pratto-help">
              Selecione explicitamente o menu que deseja gerenciar.
            </p>
          ) : null}
        </section>
      ) : null}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>{visible.length} categorias ativas ou inativas</SectionLabel>
          <h1 className="mt-1 pratto-page-title">Categorias</h1>
          <p className="mt-1 text-[15px] text-ink-faint">
            Organize as seções do cardápio publicado.
          </p>
        </div>
        <Button
          disabled={!menuId}
          onClick={() => {
            setEditingId(null);
            form.reset({ name: '', description: '' });
            setDrawerOpen(true);
          }}
        >
          <Plus size={18} /> Nova categoria
        </Button>
      </header>

      {!menuId ? (
        <EmptyState
          icon={LayoutGrid}
          title="Escolha um menu"
          description="O menu alvo precisa ser selecionado antes de consultar ou alterar categorias."
        />
      ) : categoriesQuery.isPending ? (
        <CategoryTableSkeleton />
      ) : categoriesQuery.error || !categoriesQuery.data ? (
        <ErrorState
          description={messageFor(categoriesQuery.error)}
          onRetry={() => void categoriesQuery.refetch()}
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-cream">
          {categories.length === 0 ? (
            <EmptyState
              title="Nenhuma categoria cadastrada."
              description="Crie a primeira categoria para começar a organizar os pratos."
              action={
                <Button onClick={() => setDrawerOpen(true)}>
                  <Plus size={17} /> Criar categoria
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[52px_1fr_180px_150px] gap-4 border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  <span />
                  <span>Categoria</span>
                  <span>Status</span>
                  <span className="text-right">Ações</span>
                </div>
                <div className="divide-y divide-line">
                  {categories.map((category) => {
                    const archived = Boolean(category.archivedAt);
                    const index = visible.findIndex((item) => item.id === category.id);
                    return (
                      <div
                        key={category.id}
                        className={`grid grid-cols-[52px_1fr_180px_150px] items-center gap-4 px-4 py-3 transition hover:bg-sand/45 ${archived ? 'opacity-55' : ''}`}
                      >
                        <div className="flex items-center text-ink-faint">
                          <GripVertical size={17} />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={busy || archived || index === 0}
                              aria-label={`Mover ${category.name} para cima`}
                              onClick={() => move(category, -1)}
                              className="rounded hover:bg-sand disabled:opacity-25"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={busy || archived || index === visible.length - 1}
                              aria-label={`Mover ${category.name} para baixo`}
                              onClick={() => move(category, 1)}
                              className="rounded hover:bg-sand disabled:opacity-25"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium text-ink">
                            {category.name}
                          </p>
                          <p className="truncate text-sm text-ink-faint">
                            {category.description || 'Sem descrição'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Toggle
                            on={!archived && category.status === 'ACTIVE'}
                            disabled={busy || archived}
                            ariaLabel={`Categoria ${category.name} ativa`}
                            onToggle={() =>
                              status.mutate({
                                category,
                                action: category.status === 'ACTIVE' ? 'deactivate' : 'activate',
                              })
                            }
                          />
                          <span className="text-sm text-ink-soft">
                            {archived
                              ? 'Arquivada'
                              : category.status === 'ACTIVE'
                                ? 'Ativa'
                                : 'Inativa'}
                          </span>
                        </div>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            disabled={busy || archived}
                            onClick={() => {
                              setEditingId(category.id);
                              setDrawerOpen(true);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition hover:bg-sand-deep hover:text-ink"
                            aria-label={`Editar ${category.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={busy || archived}
                            onClick={() => setArchiving(category)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition hover:bg-accent/10 hover:text-accent-deep"
                            aria-label={`Arquivar ${category.name}`}
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
      )}
      {mutationError ? (
        <p className="mt-4 pratto-error" role="alert">
          {messageFor(mutationError)}
        </p>
      ) : null}

      <CategoryDrawer
        open={drawerOpen}
        editing={editing}
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
      <ArchiveDialog
        category={archiving}
        pending={archive.isPending}
        onCancel={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) archive.mutate(archiving);
        }}
      />
    </div>
  );
}

function CategoryDrawer({
  open,
  editing,
  form,
  saving,
  saveError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: CategoryResponse | null;
  form: ReturnType<typeof useForm<CategoryFormValues>>;
  saving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => void;
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
        aria-labelledby="category-drawer-title"
        className={`absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col bg-cream shadow-[-24px_0_60px_-30px_rgba(24,23,22,0.5)] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2
              id="category-drawer-title"
              className="font-serif text-[24px] leading-tight text-ink"
            >
              {editing ? 'Editar categoria' : 'Nova categoria'}
            </h2>
            <p className="mt-0.5 text-sm text-ink-faint">
              {editing ? editing.name : 'Organize seu cardápio em seções'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            disabled={saving}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-sand"
          >
            <X size={18} />
          </button>
        </header>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <SectionLabel>Detalhes</SectionLabel>
            <Field label="Nome da categoria" required error={form.formState.errors.name?.message}>
              <TextInput
                invalid={Boolean(form.formState.errors.name)}
                {...form.register('name')}
                placeholder="Ex.: Entradas"
              />
            </Field>
            <Field
              label="Descrição"
              hint="Opcional — um resumo curto da seção."
              error={form.formState.errors.description?.message}
            >
              <Textarea
                rows={3}
                {...form.register('description')}
                placeholder="Pequenos pratos para começar."
              />
            </Field>
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
              {saving ? 'Salvando…' : 'Salvar categoria'}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ArchiveDialog({
  category,
  pending,
  onConfirm,
  onCancel,
}: {
  category: CategoryResponse | null;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useModalDialog(Boolean(category), dialogRef, onCancel);
  if (!category) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Cancelar arquivamento"
        onClick={onCancel}
        className="absolute inset-0 bg-ink/45"
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-title"
        className="relative w-full max-w-sm rounded-2xl bg-cream p-6 shadow-2xl"
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-deep">
          <AlertTriangle size={20} />
        </div>
        <h3 id="archive-title" className="text-[18px] font-semibold text-ink">
          Arquivar categoria?
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          “{category.name}” deixará o rascunho ativo. Publicações anteriores permanecem imutáveis.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? 'Arquivando…' : 'Arquivar'}
          </Button>
        </div>
      </section>
    </div>
  );
}

function CategoryLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" role="status">
      <Skeleton className="h-10 w-44" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
function CategoryTableSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando categorias">
      <Skeleton className="h-12 rounded-2xl" />
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
