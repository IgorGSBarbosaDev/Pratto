const DAY_MS = 24 * 60 * 60 * 1000;

export function calendarDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

export function dateRangeForDays(
  days: number,
  timeZone: string,
  now = new Date(),
): { fromDate: string; toDate: string } {
  const toDate = calendarDateInTimeZone(now, timeZone);
  const from = new Date(`${toDate}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { fromDate: from.toISOString().slice(0, 10), toDate };
}

export function formatDashboardDay(day: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

export function inclusiveDays(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  return (to - from) / DAY_MS + 1;
}
