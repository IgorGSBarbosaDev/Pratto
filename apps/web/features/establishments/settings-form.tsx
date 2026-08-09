'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type {
  EstablishmentAddress,
  EstablishmentAssetKind,
  EstablishmentOperatingHours,
  EstablishmentSettingsResponse,
  UpdateEstablishmentInput,
} from '@pratto/contracts';
import { establishmentUpdateSchema } from '@pratto/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form';

import { ApiClientError } from '../auth/api-client';

import { establishmentApi } from './api-client';

const EMPTY_ADDRESS: EstablishmentAddress = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  postalCode: '',
};

const DAYS: Array<{ key: keyof EstablishmentOperatingHours; label: string }> = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível concluir a solicitação.';
}

function assetLabel(kind: EstablishmentAssetKind): string {
  return kind === 'logo' ? 'logo' : 'imagem de capa';
}

type FormValues = UpdateEstablishmentInput;

export function EstablishmentSettingsForm({ establishmentId }: { establishmentId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['establishment-settings', establishmentId],
    queryFn: () => establishmentApi.get(establishmentId),
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(establishmentUpdateSchema) as unknown as Resolver<FormValues>,
    defaultValues: { address: EMPTY_ADDRESS },
  });
  const fileInputs = useRef<Record<EstablishmentAssetKind, HTMLInputElement | null>>({
    logo: null,
    cover: null,
  });

  useEffect(() => {
    if (!query.data) return;
    form.reset({
      name: query.data.name,
      slug: query.data.slug,
      description: query.data.description ?? '',
      phone: query.data.phone ?? '',
      whatsapp: query.data.whatsapp ?? '',
      address: query.data.address ?? EMPTY_ADDRESS,
      operatingHours: query.data.operatingHours,
      theme: query.data.theme,
    });
  }, [form, query.data]);

  const save = useMutation({
    mutationFn: (input: FormValues) => establishmentApi.update(establishmentId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(['establishment-settings', establishmentId], data);
    },
  });
  const upload = useMutation({
    mutationFn: ({ kind, file }: { kind: EstablishmentAssetKind; file: File }) =>
      establishmentApi.uploadAsset(establishmentId, kind, file),
    onSuccess: (data) => {
      queryClient.setQueryData(['establishment-settings', establishmentId], data);
    },
  });
  const remove = useMutation({
    mutationFn: (kind: EstablishmentAssetKind) =>
      establishmentApi.removeAsset(establishmentId, kind),
    onSuccess: (data) => {
      queryClient.setQueryData(['establishment-settings', establishmentId], data);
    },
  });

  if (query.isPending) {
    return (
      <p role="status" className="text-sm text-slate-400">
        Carregando configurações…
      </p>
    );
  }
  if (query.error || !query.data) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200"
      >
        {messageFor(query.error)}
      </div>
    );
  }

  const settings = query.data;
  const isBusy = save.isPending || upload.isPending || remove.isPending;

  function submit(values: FormValues) {
    save.mutate(values);
  }

  function selectFile(kind: EstablishmentAssetKind, file: File | undefined) {
    if (file) upload.mutate({ kind, file });
  }

  return (
    <div className="space-y-6">
      <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Dados públicos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Essas informações aparecem no cardápio publicado.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Nome público
              <input className={inputClass} {...form.register('name')} />
              {form.formState.errors.name && (
                <FieldError message={form.formState.errors.name.message} />
              )}
            </label>
            <label className="text-sm">
              Slug público
              <input className={inputClass} {...form.register('slug')} />
              {form.formState.errors.slug && (
                <FieldError message={form.formState.errors.slug.message} />
              )}
            </label>
            <label className="text-sm md:col-span-2">
              Descrição
              <textarea className={inputClass} rows={4} {...form.register('description')} />
              {form.formState.errors.description && (
                <FieldError message={form.formState.errors.description.message} />
              )}
            </label>
            <label className="text-sm">
              Telefone
              <input className={inputClass} inputMode="tel" {...form.register('phone')} />
              {form.formState.errors.phone && (
                <FieldError message={form.formState.errors.phone.message} />
              )}
            </label>
            <label className="text-sm">
              WhatsApp
              <input className={inputClass} inputMode="tel" {...form.register('whatsapp')} />
              {form.formState.errors.whatsapp && (
                <FieldError message={form.formState.errors.whatsapp.message} />
              )}
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Endereço</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <AddressField form={form} name="street" label="Rua" className="md:col-span-2" />
            <AddressField form={form} name="number" label="Número" />
            <AddressField form={form} name="complement" label="Complemento" />
            <AddressField
              form={form}
              name="neighborhood"
              label="Bairro"
              className="md:col-span-2"
            />
            <AddressField form={form} name="city" label="Cidade" />
            <AddressField form={form} name="state" label="Estado" />
            <AddressField form={form} name="postalCode" label="CEP" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Horários de funcionamento</h2>
          <div className="mt-5 space-y-3">
            {DAYS.map(({ key, label }) => (
              <div className="grid items-center gap-3 sm:grid-cols-[10rem_6rem_1fr_1fr]" key={key}>
                <span className="text-sm">{label}</span>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" {...form.register(`operatingHours.${key}.closed`)} />{' '}
                  Fechado
                </label>
                <input
                  className={inputClass}
                  type="time"
                  aria-label={`${label} abre`}
                  {...form.register(`operatingHours.${key}.open`)}
                />
                <input
                  className={inputClass}
                  type="time"
                  aria-label={`${label} fecha`}
                  {...form.register(`operatingHours.${key}.close`)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Tema básico</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Modo
              <select className={inputClass} {...form.register('theme.mode')}>
                <option value="LIGHT">Claro</option>
                <option value="DARK">Escuro</option>
              </select>
            </label>
            <label className="text-sm">
              Cor principal
              <input
                className={`${inputClass} h-10 p-1`}
                type="color"
                {...form.register('theme.primaryColor')}
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isBusy}
          >
            {save.isPending ? 'Salvando…' : 'Salvar configurações'}
          </button>
          {save.isSuccess && (
            <p className="text-sm text-emerald-300" role="status">
              Configurações salvas.
            </p>
          )}
          {save.error && (
            <p className="text-sm text-rose-300" role="alert">
              {messageFor(save.error)}
            </p>
          )}
        </div>
      </form>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Identidade visual</h2>
        <p className="mt-1 text-sm text-slate-400">JPEG, PNG ou WebP de até 5 MB.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <AssetCard
            kind="logo"
            asset={settings.logo}
            inputRef={(input) => {
              fileInputs.current.logo = input;
            }}
            onChoose={() => fileInputs.current.logo?.click()}
            onFile={(file) => selectFile('logo', file)}
            onRemove={() => remove.mutate('logo')}
            busy={upload.isPending && upload.variables?.kind === 'logo'}
          />
          <AssetCard
            kind="cover"
            asset={settings.coverImage}
            inputRef={(input) => {
              fileInputs.current.cover = input;
            }}
            onChoose={() => fileInputs.current.cover?.click()}
            onFile={(file) => selectFile('cover', file)}
            onRemove={() => remove.mutate('cover')}
            busy={upload.isPending && upload.variables?.kind === 'cover'}
          />
        </div>
        {upload.error && (
          <p className="mt-4 text-sm text-rose-300" role="alert">
            {messageFor(upload.error)}
          </p>
        )}
        {remove.error && (
          <p className="mt-4 text-sm text-rose-300" role="alert">
            {messageFor(remove.error)}
          </p>
        )}
      </section>
    </div>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <span className="mt-1 block text-xs text-rose-300">{message}</span> : null;
}

function AddressField({
  form,
  name,
  label,
  className = '',
}: {
  form: UseFormReturn<FormValues>;
  name: keyof EstablishmentAddress;
  label: string;
  className?: string;
}) {
  return (
    <label className={`text-sm ${className}`}>
      {label}
      <input className={inputClass} {...form.register(`address.${name}`)} />
      {form.formState.errors.address?.[name] && (
        <FieldError message={form.formState.errors.address[name]?.message} />
      )}
    </label>
  );
}

function AssetCard({
  kind,
  asset,
  inputRef,
  onChoose,
  onFile,
  onRemove,
  busy,
}: {
  kind: EstablishmentAssetKind;
  asset: EstablishmentSettingsResponse['logo'];
  inputRef: (input: HTMLInputElement | null) => void;
  onChoose: () => void;
  onFile: (file: File) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium capitalize">{assetLabel(kind)}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {asset ? asset.contentType : 'Nenhum arquivo selecionado'}
          </p>
        </div>
        {asset && (
          <button
            className="text-xs text-rose-300 hover:text-rose-200"
            type="button"
            onClick={onRemove}
          >
            Remover
          </button>
        )}
      </div>
      <div
        className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900 bg-cover bg-center text-xs text-slate-500"
        role="img"
        aria-label={
          asset ? `Prévia da ${assetLabel(kind)}` : `Nenhuma ${assetLabel(kind)} selecionada`
        }
        style={asset ? { backgroundImage: `url(${asset.url})` } : undefined}
      >
        {!asset && 'Nenhuma imagem'}
      </div>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
      <button
        className="mt-4 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-emerald-400 disabled:opacity-60"
        type="button"
        disabled={busy}
        onClick={onChoose}
      >
        {busy ? 'Enviando…' : asset ? 'Trocar imagem' : 'Selecionar imagem'}
      </button>
    </div>
  );
}
