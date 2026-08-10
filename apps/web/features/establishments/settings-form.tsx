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
import { Check, Image as ImageIcon, Moon, UploadCloud } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form';

import { ApiClientError } from '../auth/api-client';
import { ErrorState, Skeleton } from '../design-system/feedback';
import { Button, SectionLabel, Toggle } from '../design-system/primitives';

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

const ACCENT_PRESETS = ['#f45b3d', '#c96a4a', '#3f7652', '#d9a62e', '#76506f', '#4b61a8'];

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível concluir a solicitação.';
}

function assetLabel(kind: EstablishmentAssetKind): string {
  return kind === 'logo' ? 'logo' : 'imagem de capa';
}

type FormValues = UpdateEstablishmentInput;
type SettingsSection = 'info' | 'hours' | 'appearance' | 'all';

export function EstablishmentSettingsForm({
  establishmentId,
  section = 'all',
}: {
  establishmentId: string;
  section?: SettingsSection;
}) {
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

  if (query.isPending) return <SettingsLoading section={section} />;
  if (query.error || !query.data) {
    return (
      <div className="mx-auto max-w-3xl pt-12">
        <ErrorState description={messageFor(query.error)} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const settings = query.data;
  const isBusy = save.isPending || upload.isPending || remove.isPending;
  const showInfo = section === 'info' || section === 'all';
  const showHours = section === 'hours' || section === 'all';
  const showAppearance = section === 'appearance' || section === 'all';
  const title =
    section === 'hours' ? 'Horários' : section === 'appearance' ? 'Aparência' : 'Informações';
  const maxWidth =
    section === 'hours' ? 'max-w-2xl' : section === 'appearance' ? 'max-w-5xl' : 'max-w-3xl';
  const accent = form.watch('theme.primaryColor') ?? '#f45b3d';

  return (
    <div className={`mx-auto ${maxWidth}`}>
      <header className="mb-6">
        <SectionLabel>Restaurante</SectionLabel>
        <h1 className="mt-1 pratto-page-title">{title}</h1>
        {section === 'hours' ? (
          <p className="mt-1 text-[15px] text-ink-faint">
            Defina os horários de funcionamento para cada dia da semana.
          </p>
        ) : null}
        {section === 'appearance' ? (
          <p className="mt-1 max-w-xl text-[15px] text-ink-faint">
            Personalize a cor de destaque e o modo do menu. A identidade neutra continua valorizando
            as fotos.
          </p>
        ) : null}
      </header>

      <form className="space-y-8" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        {showInfo ? (
          <>
            <section>
              <h2 className="mb-3 text-[15px] font-semibold text-ink">Identidade visual</h2>
              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <AssetCard
                  kind="logo"
                  asset={settings.logo}
                  inputRef={(input) => {
                    fileInputs.current.logo = input;
                  }}
                  onChoose={() => fileInputs.current.logo?.click()}
                  onFile={(file) => upload.mutate({ kind: 'logo', file })}
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
                  onFile={(file) => upload.mutate({ kind: 'cover', file })}
                  onRemove={() => remove.mutate('cover')}
                  busy={upload.isPending && upload.variables?.kind === 'cover'}
                />
              </div>
              {upload.error || remove.error ? (
                <p className="mt-3 pratto-error" role="alert">
                  {messageFor(upload.error ?? remove.error)}
                </p>
              ) : null}
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-semibold text-ink">Sobre</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField form={form} name="name" label="Nome do restaurante" required />
                <TextField form={form} name="slug" label="Endereço público" />
              </div>
              <label className="pratto-label">
                Descrição
                <textarea
                  className="pratto-input mt-1"
                  rows={4}
                  {...form.register('description')}
                />
                <FieldError message={form.formState.errors.description?.message} />
              </label>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-semibold text-ink">Endereço</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                <AddressField form={form} name="street" label="Rua" className="sm:col-span-2" />
                <AddressField form={form} name="number" label="Número" />
                <AddressField form={form} name="complement" label="Complemento" />
                <AddressField
                  form={form}
                  name="neighborhood"
                  label="Bairro"
                  className="sm:col-span-2"
                />
                <AddressField form={form} name="city" label="Cidade" />
                <AddressField form={form} name="state" label="Estado" />
                <AddressField form={form} name="postalCode" label="CEP" />
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-semibold text-ink">Contato</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField form={form} name="phone" label="Telefone" inputMode="tel" />
                <TextField form={form} name="whatsapp" label="WhatsApp" inputMode="tel" />
              </div>
            </section>
          </>
        ) : null}

        {showHours ? (
          <section className="overflow-hidden rounded-2xl border border-line bg-cream">
            <ul className="divide-y divide-line">
              {DAYS.map(({ key, label }) => {
                const closed = form.watch(`operatingHours.${key}.closed`) ?? false;
                return (
                  <li
                    key={key}
                    className={`flex flex-wrap items-center gap-4 px-4 py-4 sm:flex-nowrap ${closed ? 'bg-sand/45' : ''}`}
                  >
                    <div className="flex w-40 items-center gap-3">
                      <Toggle
                        on={!closed}
                        ariaLabel={`${label} aberto`}
                        onToggle={() =>
                          form.setValue(`operatingHours.${key}.closed`, !closed, {
                            shouldDirty: true,
                          })
                        }
                      />
                      <span className="text-[15px] font-medium text-ink">{label}</span>
                    </div>
                    {closed ? (
                      <span className="flex flex-1 items-center gap-1.5 text-sm font-medium text-ink-faint">
                        <Moon size={15} /> Fechado
                      </span>
                    ) : (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          className="pratto-input tnum max-w-36"
                          type="time"
                          aria-label={`${label} abre`}
                          {...form.register(`operatingHours.${key}.open`)}
                        />
                        <span className="text-ink-faint">até</span>
                        <input
                          className="pratto-input tnum max-w-36"
                          type="time"
                          aria-label={`${label} fecha`}
                          {...form.register(`operatingHours.${key}.close`)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {showAppearance ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            <div className="space-y-8">
              <section>
                <h2 className="mb-3 text-[15px] font-semibold text-ink">Cor de destaque</h2>
                <div className="flex flex-wrap gap-3">
                  {ACCENT_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Usar cor ${color}`}
                      aria-pressed={accent.toLowerCase() === color}
                      onClick={() =>
                        form.setValue('theme.primaryColor', color, { shouldDirty: true })
                      }
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ring-offset-2 ring-offset-sand transition ${accent.toLowerCase() === color ? 'ring-2 ring-ink' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    >
                      {accent.toLowerCase() === color ? (
                        <Check size={18} className="text-white" />
                      ) : null}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex gap-3">
                  <input
                    aria-label="Escolher cor principal"
                    className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-cream p-1"
                    type="color"
                    {...form.register('theme.primaryColor')}
                  />
                  <input
                    className="pratto-input tnum max-w-40 uppercase"
                    aria-label="Cor principal em hexadecimal"
                    {...form.register('theme.primaryColor')}
                  />
                </div>
                <p className="mt-4 pratto-help">
                  Aplicada a chips, botões, navegação ativa e pequenos destaques.
                </p>
              </section>
              <section>
                <h2 className="mb-3 text-[15px] font-semibold text-ink">Modo do menu</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(['LIGHT', 'DARK'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => form.setValue('theme.mode', mode, { shouldDirty: true })}
                      className={`rounded-2xl border p-4 text-left transition ${form.watch('theme.mode') === mode ? 'border-ink bg-cream' : 'border-line bg-transparent hover:bg-cream/60'}`}
                    >
                      <span
                        className={`block h-16 rounded-xl ${mode === 'LIGHT' ? 'bg-cream ring-1 ring-line' : 'bg-ink'}`}
                      />
                      <span className="mt-3 block text-sm font-medium text-ink">
                        {mode === 'LIGHT' ? 'Claro' : 'Escuro'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <AppearancePreview settings={settings} accent={accent} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line pt-5">
          {save.isSuccess ? (
            <p
              className="mr-auto flex items-center gap-2 text-sm font-medium text-herb"
              role="status"
            >
              <Check size={16} /> Configurações salvas.
            </p>
          ) : null}
          {save.error ? (
            <p className="mr-auto pratto-error" role="alert">
              {messageFor(save.error)}
            </p>
          ) : null}
          <Button type="submit" disabled={isBusy}>
            {save.isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{' '}
                Salvando…
              </>
            ) : section === 'hours' ? (
              'Salvar horários'
            ) : section === 'appearance' ? (
              'Salvar aparência'
            ) : (
              'Salvar informações'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SettingsLoading({ section }: { section: SettingsSection }) {
  return (
    <div
      className={`mx-auto space-y-4 ${section === 'appearance' ? 'max-w-5xl' : 'max-w-3xl'}`}
      role="status"
      aria-label="Carregando configurações"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-52" />
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}

function TextField({
  form,
  name,
  label,
  required,
  inputMode,
}: {
  form: UseFormReturn<FormValues>;
  name: 'name' | 'slug' | 'phone' | 'whatsapp';
  label: string;
  required?: boolean;
  inputMode?: 'tel';
}) {
  return (
    <label className="pratto-label">
      {label}
      {required ? <span className="text-accent-deep"> *</span> : null}
      <input className="pratto-input mt-1" inputMode={inputMode} {...form.register(name)} />
      <FieldError message={form.formState.errors[name]?.message} />
    </label>
  );
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
    <label className={`pratto-label ${className}`}>
      {label}
      <input className="pratto-input mt-1" {...form.register(`address.${name}`)} />
      <FieldError message={form.formState.errors.address?.[name]?.message} />
    </label>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <span className="mt-1 block pratto-error">{message}</span> : null;
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
  const cover = kind === 'cover';
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium capitalize text-ink">{assetLabel(kind)}</span>
        {asset ? (
          <button className="text-xs font-medium text-accent-deep" type="button" onClick={onRemove}>
            Remover
          </button>
        ) : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onChoose}
        className={`group relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-cream transition hover:border-ink/25 ${cover ? 'aspect-[16/9]' : 'aspect-square'}`}
      >
        {asset ? (
          <span
            className="absolute inset-0 bg-cover bg-center transition group-hover:scale-[1.02]"
            style={{ backgroundImage: `url(${asset.url})` }}
          />
        ) : (
          <span className="flex flex-col items-center gap-2 text-ink-faint">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sand text-ink-soft">
              <UploadCloud size={20} />
            </span>
            <span className="text-sm font-medium">
              {busy ? 'Enviando…' : cover ? 'Enviar capa' : 'Enviar logo'}
            </span>
            <span className="text-xs">PNG, JPG ou WebP</span>
          </span>
        )}
      </button>
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
    </div>
  );
}

function AppearancePreview({
  settings,
  accent,
}: {
  settings: EstablishmentSettingsResponse;
  accent: string;
}) {
  const style = { '--preview-accent': accent } as CSSProperties;
  return (
    <div className="lg:sticky lg:top-8" style={style}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[var(--preview-accent)]" />
        <span className="text-[13px] font-medium text-ink-soft">Prévia ao vivo</span>
      </div>
      <div className="mx-auto w-fit rounded-[40px] border-[9px] border-ink bg-ink shadow-[0_24px_50px_-24px_rgba(24,23,22,0.5)]">
        <div className="relative h-[600px] w-[300px] overflow-hidden rounded-[31px] bg-cream">
          <div className="relative h-[46%] bg-sand">
            {settings.coverImage ? (
              <span
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${settings.coverImage.url})` }}
              />
            ) : (
              <span className="flex h-full items-center justify-center text-ink-faint">
                <ImageIcon size={28} />
              </span>
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-cream to-transparent" />
          </div>
          <div className="relative -mt-10 flex flex-col items-center px-5 text-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-ink font-serif text-4xl text-cream shadow-[0_14px_30px_-16px_rgba(24,23,22,.55)]">
              {settings.logo ? (
                <span
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${settings.logo.url})` }}
                />
              ) : (
                settings.name.slice(0, 1)
              )}
            </div>
            <h3 className="mt-4 font-serif text-[32px] leading-none text-ink">{settings.name}</h3>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-soft">
              {settings.description || 'A descrição do restaurante aparecerá aqui.'}
            </p>
            <span className="mt-6 rounded-full bg-[var(--preview-accent)] px-6 py-3 text-sm font-medium text-white">
              Explorar o menu
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
