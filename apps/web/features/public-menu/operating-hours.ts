import type { EstablishmentOperatingHours } from '@pratto/contracts';

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function isOpenNow(
  hours: EstablishmentOperatingHours,
  timeZone: string,
  now = new Date(),
): boolean {
  const localParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = new Map(localParts.map((part) => [part.type, part.value]));
  const weekday = values.get('weekday')?.toLowerCase();
  const dayIndex = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  if (dayIndex < 0) return false;

  const minute = Number(values.get('hour')) * 60 + Number(values.get('minute'));
  const today = hours[WEEKDAYS[dayIndex]!];
  if (!today.closed && isWithinHours(today.open, today.close, minute)) return true;

  const previousIndex = (dayIndex + WEEKDAYS.length - 1) % WEEKDAYS.length;
  const previous = hours[WEEKDAYS[previousIndex]!];
  const open = minutes(previous.open);
  const close = minutes(previous.close);
  return !previous.closed && open > close && minute < close;
}

function isWithinHours(openValue: string, closeValue: string, minute: number): boolean {
  const open = minutes(openValue);
  const close = minutes(closeValue);
  if (open === close) return false;
  if (open < close) return minute >= open && minute < close;
  return minute >= open;
}

function minutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours! * 60 + minutes!;
}
