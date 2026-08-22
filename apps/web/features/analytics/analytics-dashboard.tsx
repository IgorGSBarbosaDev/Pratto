'use client';

import type {
  AnalyticsDashboardQuery,
  AnalyticsDashboardResponse,
  AnalyticsDailyMetric,
} from '@pratto/contracts';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, MousePointerClick, Phone, QrCode, ScanSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { ApiClientError } from '../auth/api-client';
import { ErrorState, Skeleton } from '../design-system/feedback';
import { SectionLabel, Select } from '../design-system/primitives';

import { analyticsApi } from './api-client';

type PeriodPreset = '7' | '30' | 'custom';
type ChartMetric =
  'menuAccesses' | 'impressions' | 'qualifiedViews' | 'interactions' | 'contactClicks';

const DAY_MS = 24 * 60 * 60 * 1000;

const chartMetrics: Array<{ value: ChartMetric; label: string }> = [
  { value: 'menuAccesses', label: 'Acessos' },
  { value: 'impressions', label: 'Impressões' },
  { value: 'qualifiedViews', label: 'Visualizações qualificadas' },
  { value: 'interactions', label: 'Interações' },
  { value: 'contactClicks', label: 'Cliques em contato' },
];

function dateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateRangeForDays(days: number): { fromDate: string; toDate: string } {
  const today = new Date();
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  return { fromDate: dateInputValue(from), toDate: dateInputValue(to) };
}

function toDashboardQuery(
  fromDate: string,
  toDate: string,
  categoryId?: string,
  productId?: string,
) {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  to.setUTCDate(to.getUTCDate() + 1);
  const query: AnalyticsDashboardQuery = {
    from: from.toISOString(),
    to: to.toISOString(),
  };
  if (categoryId) query.categoryId = categoryId;
  if (productId) query.productId = productId;
  return query;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Não foi possível carregar os dados de analytics.';
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function AnalyticsDashboard({ establishmentId }: { establishmentId: string }) {
  const defaultRange = dateRangeForDays(30);
  const [period, setPeriod] = useState<PeriodPreset>('30');
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [appliedQuery, setAppliedQuery] = useState<AnalyticsDashboardQuery>(() =>
    toDashboardQuery(defaultRange.fromDate, defaultRange.toDate),
  );
  const [filterError, setFilterError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('qualifiedViews');

  const query = useQuery({
    queryKey: ['analytics-dashboard', establishmentId, appliedQuery],
    queryFn: () => analyticsApi.getDashboard(establishmentId, appliedQuery),
  });

  const availableProducts = useMemo(() => {
    const products = query.data?.filters.products ?? [];
    return categoryId ? products.filter((product) => product.categoryId === categoryId) : products;
  }, [categoryId, query.data?.filters.products]);

  const applyQuery = (nextFromDate: string, nextToDate: string) => {
    if (!nextFromDate || !nextToDate) {
      setFilterError('Informe o início e o fim do período.');
      return;
    }
    const from = new Date(`${nextFromDate}T00:00:00.000Z`);
    const to = new Date(`${nextToDate}T00:00:00.000Z`);
    const duration = to.getTime() - from.getTime();
    if (duration <= 0) {
      setFilterError('O fim do período deve ser posterior ao início.');
      return;
    }
    if (duration > 366 * DAY_MS) {
      setFilterError('O período não pode ultrapassar 366 dias.');
      return;
    }
    setFilterError(null);
    setAppliedQuery(toDashboardQuery(nextFromDate, nextToDate, categoryId, productId));
  };

  const selectPreset = (days: 7 | 30) => {
    const range = dateRangeForDays(days);
    setPeriod(String(days) as '7' | '30');
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    applyQuery(range.fromDate, range.toDate);
  };

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPeriod('custom');
    applyQuery(fromDate, toDate);
  };

  return (
    <section aria-labelledby="analytics-dashboard-title" className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>Analytics anônimos</SectionLabel>
          <h1 id="analytics-dashboard-title" className="mt-1 pratto-page-title">
            Visão geral
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] text-ink-faint">
            Acompanhe como os visitantes encontram e exploram os produtos publicados.
          </p>
        </div>
        {query.isFetching && query.data ? (
          <span role="status" className="text-sm text-ink-faint">
            Atualizando…
          </span>
        ) : null}
      </div>

      <form className="mt-6 rounded-2xl border border-line bg-cream p-4" onSubmit={submitFilters}>
        <div className="flex flex-wrap items-end gap-4">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Período
            </legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
              <PeriodButton active={period === '7'} onClick={() => selectPreset(7)}>
                7 dias
              </PeriodButton>
              <PeriodButton active={period === '30'} onClick={() => selectPreset(30)}>
                30 dias
              </PeriodButton>
              <PeriodButton active={period === 'custom'} onClick={() => setPeriod('custom')}>
                Personalizado
              </PeriodButton>
            </div>
          </fieldset>

          <label className="text-sm text-ink-soft">
            Início
            <input
              className="pratto-input mt-2 w-auto"
              type="date"
              value={fromDate}
              onChange={(event) => {
                setPeriod('custom');
                setFromDate(event.target.value);
              }}
            />
          </label>
          <label className="text-sm text-ink-soft">
            Fim
            <input
              className="pratto-input mt-2 w-auto"
              type="date"
              value={toDate}
              onChange={(event) => {
                setPeriod('custom');
                setToDate(event.target.value);
              }}
            />
          </label>
          <label className="min-w-48 flex-1 text-sm text-ink-soft">
            Categoria
            <select
              className="pratto-input mt-2"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                if (
                  productId &&
                  event.target.value &&
                  !query.data?.filters.products.some(
                    (product) =>
                      product.id === productId && product.categoryId === event.target.value,
                  )
                ) {
                  setProductId('');
                }
              }}
            >
              <option value="">Todas as categorias</option>
              {(query.data?.filters.categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-48 flex-1 text-sm text-ink-soft">
            Produto
            <select
              className="pratto-input mt-2"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Todos os produtos</option>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="h-11 rounded-xl bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={query.isFetching}
          >
            Aplicar filtros
          </button>
        </div>
        {filterError ? (
          <p role="alert" className="mt-3 pratto-error">
            {filterError}
          </p>
        ) : null}
      </form>

      {query.isPending ? <DashboardLoading /> : null}
      {query.error ? (
        <div className="mt-6 pratto-panel">
          <ErrorState description={messageFor(query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : null}
      {query.data ? (
        <DashboardContent
          data={query.data}
          chartMetric={chartMetric}
          onChartMetricChange={setChartMetric}
          productFilter={Boolean(appliedQuery.productId)}
        />
      ) : null}
    </section>
  );
}

function PeriodButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:bg-sand'
      }`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DashboardLoading() {
  return (
    <div role="status" aria-label="Carregando analytics" className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

function DashboardContent({
  data,
  chartMetric,
  onChartMetricChange,
  productFilter,
}: {
  data: AnalyticsDashboardResponse;
  chartMetric: ChartMetric;
  onChartMetricChange: (metric: ChartMetric) => void;
  productFilter: boolean;
}) {
  const hasData = Object.values(data.summary).some((value) => value > 0);
  return (
    <div className="mt-4 space-y-4">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric icon={BarChart3} label="Sessões" value={data.summary.sessions} />
        <Metric icon={QrCode} label="Acessos ao cardápio" value={data.summary.menuAccesses} />
        <Metric icon={Eye} label="Impressões" value={data.summary.impressions} />
        <Metric
          icon={ScanSearch}
          label="Visualizações qualificadas"
          value={data.summary.qualifiedViews}
        />
        <Metric icon={MousePointerClick} label="Interações" value={data.summary.interactions} />
        <Metric icon={Phone} label="Cliques em contato" value={data.summary.contactClicks} />
      </dl>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-line bg-cream p-8 text-center">
          <h3 className="text-lg font-semibold text-ink">Ainda não há dados neste período</h3>
          <p className="mt-2 text-sm text-ink-faint">
            Quando visitantes explorarem o cardápio publicado, as métricas aparecerão aqui.
          </p>
        </div>
      ) : (
        <>
          <EvolutionPanel
            daily={data.daily}
            metric={chartMetric}
            onMetricChange={onChartMetricChange}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <RankingPanel
              title="Produtos mais vistos"
              emptyMessage="Nenhum produto teve visualização no recorte selecionado."
              items={data.products.map((product) => ({
                id: product.productId,
                name: product.name,
                detail: product.categoryName,
                value: product.qualifiedViews,
                valueLabel: 'visualizações qualificadas',
              }))}
            />
            {productFilter ? (
              <section className="rounded-2xl border border-line bg-cream p-5">
                <h3 className="text-base font-semibold text-ink">Categorias mais acessadas</h3>
                <p className="mt-4 text-sm text-ink-faint">
                  O ranking de categorias não é aplicável quando um produto está selecionado.
                </p>
              </section>
            ) : (
              <RankingPanel
                title="Categorias mais acessadas"
                emptyMessage="Nenhuma categoria foi selecionada no recorte selecionado."
                items={data.categories.map((category) => ({
                  id: category.categoryId,
                  name: category.name,
                  detail: 'categoria',
                  value: category.views,
                  valueLabel: 'acessos',
                }))}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-cream p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sand text-ink-soft">
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <dd className="tnum mt-4 text-[30px] font-semibold leading-none text-ink">
        {formatNumber(value)}
      </dd>
      <dt className="mt-1.5 text-sm text-ink-faint">{label}</dt>
    </div>
  );
}

function EvolutionPanel({
  daily,
  metric,
  onMetricChange,
}: {
  daily: AnalyticsDailyMetric[];
  metric: ChartMetric;
  onMetricChange: (metric: ChartMetric) => void;
}) {
  const max = Math.max(1, ...daily.map((day) => day[metric]));
  const currentMetric = chartMetrics.find((item) => item.value === metric)!;
  const points = daily.map((day, index) => ({
    x: daily.length === 1 ? 50 : (index / Math.max(1, daily.length - 1)) * 100,
    y: 32 - (day[metric] / max) * 27,
    value: day[metric],
    day: day.day,
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = points.length > 0 ? `${linePath} L 100 36 L 0 36 Z` : '';
  return (
    <section className="rounded-2xl border border-line bg-cream p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Evolução diária</h3>
          <p className="mt-1 text-sm text-ink-faint">{currentMetric.label} por dia no período.</p>
        </div>
        <label className="text-sm text-ink-soft">
          Métrica
          <Select
            className="ml-2 inline-block w-auto"
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as ChartMetric)}
          >
            {chartMetrics.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="mt-6" role="img" aria-label={`Evolução de ${currentMetric.label}`}>
        {points.length > 0 ? (
          <>
            <div className="relative h-56 overflow-hidden rounded-xl border border-line/80 bg-sand/35 px-3 py-4">
              <div className="pointer-events-none absolute inset-x-3 inset-y-4 flex flex-col justify-between">
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className="block border-t border-line/70" />
                ))}
              </div>
              <svg
                className="relative h-full w-full overflow-visible"
                viewBox="0 0 100 36"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#analytics-area)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
                {points.map((point) => (
                  <circle
                    key={point.day}
                    cx={point.x}
                    cy={point.y}
                    r="0.9"
                    fill="var(--color-cream)"
                    stroke="var(--color-accent)"
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
            </div>
            <div className="mt-3 flex justify-between text-xs text-ink-faint" aria-hidden="true">
              <span>{formatDay(points[0]!.day)}</span>
              {points.length > 2 ? (
                <span>{formatDay(points[Math.floor(points.length / 2)]!.day)}</span>
              ) : null}
              {points.length > 1 ? <span>{formatDay(points.at(-1)!.day)}</span> : null}
            </div>
            <ol className="sr-only">
              {points.map((point) => (
                <li key={point.day}>
                  {formatDay(point.day)}: {formatNumber(point.value)}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-sm text-ink-faint">Sem pontos diários no período.</p>
        )}
      </div>
    </section>
  );
}

function RankingPanel({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: Array<{
    id: string;
    name: string;
    detail: string;
    value: number;
    valueLabel: string;
  }>;
}) {
  return (
    <section className="rounded-2xl border border-line bg-cream p-5">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">{emptyMessage}</p>
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  <span className="mr-2 text-ink-faint">{index + 1}.</span>
                  {item.name}
                </p>
                <p className="mt-1 truncate text-xs text-ink-faint">{item.detail}</p>
              </div>
              <p className="shrink-0 text-right text-sm text-ink-soft">
                <strong className="block text-ink">{formatNumber(item.value)}</strong>
                <span className="text-xs text-ink-faint">{item.valueLabel}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
