'use client';

import type {
  AnalyticsDashboardQuery,
  AnalyticsDashboardResponse,
  AnalyticsDailyMetric,
} from '@pratto/contracts';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { ApiClientError } from '../auth/api-client';

import { analyticsApi } from './api-client';

type PeriodPreset = '7' | '30' | 'custom';
type ChartMetric = 'menuAccesses' | 'impressions' | 'qualifiedViews' | 'interactions';

const DAY_MS = 24 * 60 * 60 * 1000;

const chartMetrics: Array<{ value: ChartMetric; label: string }> = [
  { value: 'menuAccesses', label: 'Acessos' },
  { value: 'impressions', label: 'Impressões' },
  { value: 'qualifiedViews', label: 'Visualizações qualificadas' },
  { value: 'interactions', label: 'Interações' },
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
    <section
      aria-labelledby="analytics-dashboard-title"
      className="mt-10 border-t border-slate-800 pt-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="analytics-dashboard-title" className="text-xl font-semibold">
            Desempenho do cardápio
          </h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            Acompanhe como os visitantes encontram e exploram os produtos publicados.
          </p>
        </div>
        {query.isFetching && query.data ? (
          <span role="status" className="text-sm text-slate-500">
            Atualizando…
          </span>
        ) : null}
      </div>

      <form
        className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
        onSubmit={submitFilters}
      >
        <div className="flex flex-wrap items-end gap-4">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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

          <label className="text-sm text-slate-300">
            Início
            <input
              className="mt-2 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              type="date"
              value={fromDate}
              onChange={(event) => {
                setPeriod('custom');
                setFromDate(event.target.value);
              }}
            />
          </label>
          <label className="text-sm text-slate-300">
            Fim
            <input
              className="mt-2 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              type="date"
              value={toDate}
              onChange={(event) => {
                setPeriod('custom');
                setToDate(event.target.value);
              }}
            />
          </label>
          <label className="min-w-48 flex-1 text-sm text-slate-300">
            Categoria
            <select
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
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
          <label className="min-w-48 flex-1 text-sm text-slate-300">
            Produto
            <select
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
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
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={query.isFetching}
          >
            Aplicar filtros
          </button>
        </div>
        {filterError ? (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {filterError}
          </p>
        ) : null}
      </form>

      {query.isPending ? <DashboardLoading /> : null}
      {query.error ? (
        <div role="alert" className="mt-6 rounded-2xl border border-rose-900/70 bg-rose-950/30 p-5">
          <p className="text-sm text-rose-200">{messageFor(query.error)}</p>
          <button
            className="mt-4 rounded-lg border border-rose-800 px-3 py-2 text-sm text-rose-100 hover:border-rose-500"
            type="button"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
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
      className={`rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
        active
          ? 'border-emerald-500 bg-emerald-900/50 text-emerald-100'
          : 'border-slate-700 text-slate-300 hover:border-slate-500'
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
    <div role="status" aria-label="Carregando analytics" className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse bg-slate-900" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
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
    <div className="mt-6 space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 md:grid-cols-5">
        <Metric label="Sessões" value={data.summary.sessions} />
        <Metric label="Acessos ao cardápio" value={data.summary.menuAccesses} />
        <Metric label="Impressões" value={data.summary.impressions} />
        <Metric label="Visualizações qualificadas" value={data.summary.qualifiedViews} />
        <Metric label="Interações" value={data.summary.interactions} />
      </dl>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">Ainda não há dados neste período</h3>
          <p className="mt-2 text-sm text-slate-400">
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
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="text-base font-semibold text-white">Categorias mais acessadas</h3>
                <p className="mt-4 text-sm text-slate-400">
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-900 p-4">
      <dt className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">{label}</dt>
      <dd className="mt-3 text-2xl font-semibold text-white">{formatNumber(value)}</dd>
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
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Evolução diária</h3>
          <p className="mt-1 text-sm text-slate-500">{currentMetric.label} por dia no período.</p>
        </div>
        <label className="text-sm text-slate-300">
          Métrica
          <select
            className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as ChartMetric)}
          >
            {chartMetrics.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-6 space-y-2" role="img" aria-label={`Evolução de ${currentMetric.label}`}>
        {daily.map((day) => {
          const value = day[metric];
          return (
            <div
              key={day.day}
              className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3 text-sm"
            >
              <span className="text-slate-500">{formatDay(day.day)}</span>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-emerald-600"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
              <strong className="text-right font-medium text-slate-200">
                {formatNumber(value)}
              </strong>
            </div>
          );
        })}
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <ol className="mt-4 divide-y divide-slate-800">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  <span className="mr-2 text-slate-600">{index + 1}.</span>
                  {item.name}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">{item.detail}</p>
              </div>
              <p className="shrink-0 text-right text-sm text-slate-300">
                <strong className="block text-white">{formatNumber(item.value)}</strong>
                <span className="text-xs text-slate-500">{item.valueLabel}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
