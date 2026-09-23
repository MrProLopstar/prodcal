import { FIRST_YEAR, YEARS } from './data.js';

/** Kind of a day: working, shortened pre-holiday, weekend, public holiday, transferred day off, or paid non-working day by presidential decree. */
export type DayKind = 'workday' | 'short' | 'weekend' | 'holiday' | 'dayoff' | 'nonworking';

/** A date as `YYYY-MM-DD`, or a `Date` read in local time. */
export type DateInput = string | Date;

/** Information about a single day. */
export interface DayInfo {
  readonly date: string;
  readonly kind: DayKind;
  readonly working: boolean;
  readonly weekday: number;
}

/** Working-time statistics of a month or a year under the official production calendar. */
export interface PeriodStats {
  readonly calendarDays: number;
  readonly workdays: number;
  readonly shortDays: number;
  readonly daysOff: number;
  readonly holidays: number;
  readonly nonWorkingDays: number;
  readonly hours: number;
}

/** Options for working-hour norms. */
export interface HoursOptions {
  readonly weekHours?: number;
}

/** Reason a call failed. */
export type ProdcalErrorCode = 'INVALID_DATE' | 'OUT_OF_RANGE' | 'INVALID_ARGUMENT';

/** Error for invalid input or dates outside the bundled calendar. */
export class ProdcalError extends Error {
  override readonly name = 'ProdcalError';
  readonly code: ProdcalErrorCode;

  constructor(code: ProdcalErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** First year covered by the bundled data. */
export const firstYear: number = FIRST_YEAR;

/** Last year covered by the bundled data. */
export const lastYear: number = FIRST_YEAR + YEARS.length - 1;

interface Code {
  readonly kind: DayKind;
  readonly official: 'workday' | 'short' | 'off';
}

const CODES: { readonly [code: string]: Code } = {
  w: { kind: 'workday', official: 'workday' },
  s: { kind: 'short', official: 'short' },
  e: { kind: 'weekend', official: 'off' },
  h: { kind: 'holiday', official: 'off' },
  d: { kind: 'dayoff', official: 'off' },
  n: { kind: 'nonworking', official: 'workday' },
  m: { kind: 'nonworking', official: 'short' },
};

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number): string => String(value).padStart(2, '0');

const serialOf = (year: number, month: number, day: number): number => Math.round(Date.UTC(year, month - 1, day) / DAY_MS);

const toIso = (serial: number): string => {
  const date = new Date(serial * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const toSerial = (input: DateInput): number => {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new ProdcalError('INVALID_DATE', 'Invalid Date');
    return serialOf(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  const match = ISO_DATE.exec(input);
  if (match === null) throw new ProdcalError('INVALID_DATE', `Expected YYYY-MM-DD, got "${input}"`);
  const serial = serialOf(Number(match[1]), Number(match[2]), Number(match[3]));
  if (toIso(serial) !== input) throw new ProdcalError('INVALID_DATE', `"${input}" is not a real date`);
  return serial;
};

const codeAt = (serial: number): Code => {
  const year = new Date(serial * DAY_MS).getUTCFullYear();
  const code = YEARS[year - FIRST_YEAR]?.charAt(serial - serialOf(year, 1, 1));
  const entry = code === undefined ? undefined : CODES[code];
  if (entry === undefined) {
    throw new ProdcalError('OUT_OF_RANGE', `${toIso(serial)} is outside the bundled calendar (${firstYear}-${lastYear})`);
  }
  return entry;
};

const isWorking = (serial: number): boolean => {
  const { kind } = codeAt(serial);
  return kind === 'workday' || kind === 'short';
};

const requireInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value)) throw new ProdcalError('INVALID_ARGUMENT', `${name} must be an integer, got ${value}`);
};

const infoAt = (serial: number): DayInfo => {
  const { kind } = codeAt(serial);
  return { date: toIso(serial), kind, working: kind === 'workday' || kind === 'short', weekday: new Date(serial * DAY_MS).getUTCDay() };
};

const step = (serial: number, direction: 1 | -1, inclusive: boolean): number => {
  let current = inclusive ? serial : serial + direction;
  while (!isWorking(current)) current += direction;
  return current;
};

const periodOf = (year: number, month: number | undefined): readonly [number, number] => {
  requireInteger(year, 'year');
  if (month === undefined) return [serialOf(year, 1, 1), serialOf(year + 1, 1, 1)];
  requireInteger(month, 'month');
  if (month < 1 || month > 12) throw new ProdcalError('INVALID_ARGUMENT', `month must be between 1 and 12, got ${month}`);
  return [serialOf(year, month, 1), serialOf(year, month + 1, 1)];
};

/** Returns the kind of a day. */
export const dayKind = (date: DateInput): DayKind => codeAt(toSerial(date)).kind;

/** Returns full information about a day. */
export const dayInfo = (date: DateInput): DayInfo => infoAt(toSerial(date));

/** Whether people work on the day: a regular or shortened working day. */
export const isWorkday = (date: DateInput): boolean => isWorking(toSerial(date));

/** Whether the day is not worked: weekend, public holiday, transferred day off or paid non-working day. */
export const isDayOff = (date: DateInput): boolean => !isWorkday(date);

/** Whether the day is a public holiday under Article 112 of the Labour Code. */
export const isHoliday = (date: DateInput): boolean => dayKind(date) === 'holiday';

/** Whether the day is a shortened pre-holiday working day. */
export const isShortDay = (date: DateInput): boolean => dayKind(date) === 'short';

/** Moves `amount` working days forward, or backward when negative, not counting the start day. */
export const addWorkdays = (date: DateInput, amount: number): string => {
  requireInteger(amount, 'amount');
  let serial = toSerial(date);
  const direction = amount < 0 ? -1 : 1;
  for (let remaining = Math.abs(amount); remaining > 0; remaining -= 1) serial = step(serial, direction, false);
  return toIso(serial);
};

/** Returns the next working day, or the date itself when `inclusive` is set and it is a working day. */
export const nextWorkday = (date: DateInput, options: { readonly inclusive?: boolean } = {}): string =>
  toIso(step(toSerial(date), 1, options.inclusive ?? false));

/** Returns the previous working day, or the date itself when `inclusive` is set and it is a working day. */
export const previousWorkday = (date: DateInput, options: { readonly inclusive?: boolean } = {}): string =>
  toIso(step(toSerial(date), -1, options.inclusive ?? false));

/** Counts working days from `from` to `to` inclusive; negative when `to` is earlier. */
export const workdaysBetween = (from: DateInput, to: DateInput): number => {
  const start = toSerial(from);
  const end = toSerial(to);
  const [low, high] = start <= end ? [start, end] : [end, start];
  let count = 0;
  for (let serial = low; serial <= high; serial += 1) if (isWorking(serial)) count += 1;
  return start <= end ? count : -count;
};

/** Lists the days of a month, or of a year when `month` is omitted. */
export const days = (year: number, month?: number): DayInfo[] => {
  const [start, end] = periodOf(year, month);
  return Array.from({ length: end - start }, (_, offset) => infoAt(start + offset));
};

/** Working days, days off and the working-hour norm of a month or a year, following Order 588n. */
export const stats = (year: number, month?: number, options: HoursOptions = {}): PeriodStats => {
  const weekHours = options.weekHours ?? 40;
  if (!(weekHours > 0 && weekHours <= 40)) throw new ProdcalError('INVALID_ARGUMENT', `weekHours must be in (0, 40], got ${weekHours}`);
  const [start, end] = periodOf(year, month);
  const codes = Array.from({ length: end - start }, (_, offset) => codeAt(start + offset));
  const workdays = codes.filter((code) => code.official !== 'off').length;
  const shortDays = codes.filter((code) => code.official === 'short').length;
  return {
    calendarDays: codes.length,
    workdays,
    shortDays,
    daysOff: codes.length - workdays,
    holidays: codes.filter((code) => code.kind === 'holiday').length,
    nonWorkingDays: codes.filter((code) => code.kind === 'nonworking').length,
    hours: Math.round(((weekHours / 5) * workdays - shortDays) * 10) / 10,
  };
};
