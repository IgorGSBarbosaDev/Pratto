'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { CategoryResponse } from '@pratto/contracts';
import { categoryCreateSchema } from '@pratto/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';

import { ApiClientError } from '../auth/api-client';

import { catalogApi } from './api-client';

type CategoryFormValues = {
  name: string;
  description?: string | null;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível concluir a solicitação.';
}

export function CategoryManagement({ establishmentId }: { establishmentId: string }) {
  const queryClient = useQueryClient();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      setMenuId(null);
      setEditingId(null);
    }
  }, [menuId, menusQuery.data]);

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
      form.reset({ name: '', description: '' });
      await invalidate();
    },
  });
  const status = useMutation({
    mutationFn: ({ category, action }: { category: CategoryResponse; action: 'activate' | 'deactivate' }) => {
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

  if (menusQuery.isPending) {
    return (
      <p role="status" className="text-sm text-slate-400">
        Carregando menus…
      </p>
    );
  }
  if (menusQuery.error || !menusQuery.data) {
    return (
      <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
        {messageFor(menusQuery.error)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <label className="block text-sm font-medium" htmlFor="catalog-menu-target">
          Menu alvo
          <select
            id="catalog-menu-target"
            className={inputClass}
            value={menuId ?? ''}
            onChange={(event) => {
              setMenuId(event.target.value || null);
              setEditingId(null);
              form.reset({ name: '', description: '' });
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
            Selecione explicitamente o menu que deseja gerenciar.
          </p>
        )}
      </section>

      {!menuId ? null : categoriesQuery.isPending ? (
        <p role="status" className="text-sm text-slate-400">
          Carregando categorias…
        </p>
      ) : categoriesQuery.error || !categoriesQuery.data ? (
        <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
          {messageFor(categoriesQuery.error)}
        </div>
      ) : (
        <CategoryEditor
          categories={categories}
          editing={editing}
          form={form}
          isBusy={save.isPending || status.isPending || archive.isPending || reorder.isPending}
          saveError={save.error}
          statusError={status.error}
          archiveError={archive.error}
          reorderError={reorder.error}
          onArchive={(category) => archive.mutate(category)}
          onEdit={(category) => setEditingId(category.id)}
          onMove={(category, direction) => {
            const visibleCategories = categories.filter((item) => !item.archivedAt);
            const currentIndex = visibleCategories.findIndex((item) => item.id === category.id);
            const targetIndex = currentIndex + direction;
            if (currentIndex < 0 || targetIndex < 0 || targetIndex >= visibleCategories.length) return;
            const next = visibleCategories.map((item) => item.id);
            [next[currentIndex], next[targetIndex]] = [next[targetIndex]!, next[currentIndex]!];
            reorder.mutate(next);
          }}
          onSubmit={(values) => save.mutate(values)}
          onToggle={(category) =>
            status.mutate({
              category,
              action: category.status === 'ACTIVE' ? 'deactivate' : 'activate',
            })
          }
          onCancelEdit={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function CategoryEditor({
  categories,
  editing,
  form,
  isBusy,
  saveError,
  statusError,
  archiveError,
  reorderError,
  onArchive,
  onEdit,
  onMove,
  onSubmit,
  onToggle,
  onCancelEdit,
}: {
  categories: CategoryResponse[];
  editing: CategoryResponse | null;
  form: ReturnType<typeof useForm<CategoryFormValues>>;
  isBusy: boolean;
  saveError: unknown;
  statusError: unknown;
  archiveError: unknown;
  reorderError: unknown;
  onArchive: (category: CategoryResponse) => void;
  onEdit: (category: CategoryResponse) => void;
  onMove: (category: CategoryResponse, direction: -1 | 1) => void;
  onSubmit: (values: CategoryFormValues) => void;
  onToggle: (category: CategoryResponse) => void;
  onCancelEdit: () => void;
}) {
  const visibleCategories = categories.filter((category) => !category.archivedAt);

  return (
    <div className="space-y-6">
      <form className="rounded-2xl border border-slate-800 bg-slate-900 p-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{editing ? 'Editar categoria' : 'Nova categoria'}</h3>
            <p className="mt-1 text-sm text-slate-400">
              Categorias fazem parte do rascunho editável e só aparecem publicamente após uma nova publicação.
            </p>
          </div>
          {editing && (
            <button className="text-sm text-slate-400 hover:text-white" type="button" onClick={onCancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            Nome
            <input className={inputClass} {...form.register('name')} />
            {form.formState.errors.name && <FieldError message={form.formState.errors.name.message} />}
          </label>
          <label className="text-sm md:col-span-2">
            Descrição opcional
            <textarea className={inputClass} rows={3} {...form.register('description')} />
            {form.formState.errors.description && <FieldError message={form.formState.errors.description.message} />}
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isBusy}
          >
            {isBusy ? 'Salvando…' : editing ? 'Salvar categoria' : 'Adicionar categoria'}
          </button>
          {Boolean(saveError) && <p className="text-sm text-rose-300" role="alert">{messageFor(saveError)}</p>}
        </div>
      </form>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Categorias do cardápio</h3>
            <p className="mt-1 text-sm text-slate-400">A ordem abaixo será usada no próximo snapshot publicado.</p>
          </div>
          <span className="text-sm text-slate-500">{visibleCategories.length} ativas ou inativas</span>
        </div>
        {categories.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            Nenhuma categoria cadastrada.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                index={visibleCategories.findIndex((item) => item.id === category.id)}
                total={visibleCategories.length}
                busy={isBusy}
                onEdit={() => onEdit(category)}
                onMove={(direction) => onMove(category, direction)}
                onToggle={() => onToggle(category)}
                onArchive={() => onArchive(category)}
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

function CategoryRow({
  category,
  index,
  total,
  busy,
  onEdit,
  onMove,
  onToggle,
  onArchive,
}: {
  category: CategoryResponse;
  index: number;
  total: number;
  busy: boolean;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  onArchive: () => void;
}) {
  const archived = Boolean(category.archivedAt);
  return (
    <article className={`rounded-xl border p-4 ${archived ? 'border-slate-800 bg-slate-950/50 opacity-70' : 'border-slate-800 bg-slate-950'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{category.name}</h4>
            <span className={`rounded-full px-2 py-0.5 text-xs ${archived ? 'bg-slate-800 text-slate-400' : category.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>
              {archived ? 'Arquivada' : category.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          {category.description && <p className="mt-1 text-sm text-slate-400">{category.description}</p>}
        </div>
        {!archived && (
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-50" type="button" disabled={busy || index === 0} onClick={() => onMove(-1)} aria-label={`Mover ${category.name} para cima`}>
              ↑
            </button>
            <button className="rounded border border-slate-700 px-2 py-1 text-xs hover:border-emerald-400 disabled:opacity-50" type="button" disabled={busy || index === total - 1} onClick={() => onMove(1)} aria-label={`Mover ${category.name} para baixo`}>
              ↓
            </button>
            <button className="rounded border border-slate-700 px-3 py-1 text-xs hover:border-emerald-400 disabled:opacity-50" type="button" disabled={busy} onClick={onEdit}>
              Editar
            </button>
            <button className="rounded border border-slate-700 px-3 py-1 text-xs hover:border-amber-400 disabled:opacity-50" type="button" disabled={busy} onClick={onToggle}>
              {category.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
            </button>
            <button className="rounded border border-rose-900 px-3 py-1 text-xs text-rose-300 hover:border-rose-500 disabled:opacity-50" type="button" disabled={busy} onClick={onArchive}>
              Arquivar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <span className="mt-1 block text-xs text-rose-300">{message}</span> : null;
}
