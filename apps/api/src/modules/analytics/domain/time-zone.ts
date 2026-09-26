const DAY_MS = 24 * 60 * 60 * 1000;

export function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Resolves the first instant belonging to a local calendar date, including DST transitions. */
export function startOfDateInTimeZone(value: string, timeZone: string): Date {
  const target = new Date(`${value}T00:00:00.000Z`).getTime();
  let before = target - 3 * DAY_MS;
  let after = target + 3 * DAY_MS;

  while (dateAt(new Date(before), timeZone) >= value) before -= DAY_MS;
  while (dateAt(new Date(after), timeZone) < value) after += DAY_MS;

  while (after - before > 1) {
    const middle = before + Math.floor((after - before) / 2);
    if (dateAt(new Date(middle), timeZone) < value) before = middle;
    else after = middle;
  }

  return new Date(after);
}

function dateAt(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}
