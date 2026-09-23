import { readFileSync, writeFileSync } from 'node:fs';

type Status = 'work' | 'short' | 'off';

interface NonWorkingRange {
  readonly from: string;
  readonly to: string;
  readonly decree: string;
  readonly shortDays: readonly string[];
}

interface Override {
  readonly date: string;
  readonly status: Status;
  readonly reason: string;
}

const FIRST_YEAR = 2013;
const LAST_YEAR = Number(process.argv[2] ?? new Date().getUTCFullYear() + 1);
const PUBLISHED_YEAR = new Date().getUTCFullYear();

class NotPublished extends Error {}

const FIXED_HOLIDAYS: ReadonlySet<string> = new Set([
  '01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08',
  '02-23', '03-08', '05-01', '05-09', '06-12', '11-04',
]);

const pad = (value: number): string => String(value).padStart(2, '0');

const daysInYear = (year: number): number => (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365);

const dateOf = (year: number, index: number): Date => new Date(Date.UTC(year, 0, 1 + index));

const isoOf = (date: Date): string => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const fetchText = async (url: string): Promise<string> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (response.status === 404) throw new NotPublished(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error: unknown) {
      if (error instanceof NotPublished) throw error;
      if (attempt >= 4) throw new Error(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
};

const fromIsDayOff = async (year: number): Promise<Status[]> => {
  const raw = (await fetchText(`https://isdayoff.ru/api/getdata?year=${year}&pre=1`)).trim();
  if (raw.length !== daysInYear(year)) throw new Error(`isdayoff ${year}: expected ${daysInYear(year)} days, got ${raw.length}`);
  return Array.from(raw, (code, index): Status => {
    if (code === '0') return 'work';
    if (code === '1') return 'off';
    if (code === '2') return 'short';
    throw new Error(`isdayoff ${year}: unexpected code "${code}" on day ${index + 1}`);
  });
};

interface XmlCalendar {
  readonly months: readonly { readonly month: number; readonly days: string }[];
}

const isXmlCalendar = (value: unknown): value is XmlCalendar =>
  typeof value === 'object' &&
  value !== null &&
  'months' in value &&
  Array.isArray(value.months) &&
  value.months.every(
    (month: unknown) =>
      typeof month === 'object' && month !== null && 'month' in month && typeof month.month === 'number' && 'days' in month && typeof month.days === 'string',
  );

const fromXmlCalendar = async (year: number): Promise<Status[]> => {
  const parsed: unknown = JSON.parse(await fetchText(`https://xmlcalendar.ru/data/ru/${year}/calendar.json`));
  if (!isXmlCalendar(parsed)) throw new Error(`xmlcalendar ${year}: unexpected format`);
  const statuses: Status[] = Array.from({ length: daysInYear(year) }, () => 'work');
  for (const { month, days } of parsed.months) {
    for (const token of days.split(',').map((part) => part.trim()).filter(Boolean)) {
      const match = /^(\d{1,2})([*+]?)$/.exec(token);
      if (match === null) throw new Error(`xmlcalendar ${year}-${month}: bad token "${token}"`);
      const day = Number(match[1]);
      const index = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000);
      statuses[index] = match[2] === '*' ? 'short' : 'off';
    }
  }
  return statuses;
};

const kindOf = (date: Date, status: Status, nonWorking: boolean): string => {
  const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
  if (nonWorking && status === 'short') return 'm';
  if (nonWorking && !weekend && !FIXED_HOLIDAYS.has(isoOf(date).slice(5)) && status !== 'work') return 'n';
  if (status === 'short') return 's';
  if (status === 'work') return 'w';
  if (FIXED_HOLIDAYS.has(isoOf(date).slice(5))) return 'h';
  return weekend ? 'e' : 'd';
};

const overrides: readonly Override[] = JSON.parse(readFileSync(new URL('../data/overrides.json', import.meta.url), 'utf8')) as Override[];
const overrideByDate = new Map(overrides.map((override) => [override.date, override]));
const ranges: readonly NonWorkingRange[] = JSON.parse(readFileSync(new URL('../data/nonworking.json', import.meta.url), 'utf8')) as NonWorkingRange[];
const isNonWorking = (iso: string): boolean => ranges.some((range) => range.from <= iso && iso <= range.to);
const isOfficialShort = (iso: string): boolean => ranges.some((range) => range.shortDays.includes(iso));

const years: string[] = [];
const conflicts: string[] = [];

for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 1) {
  let sources: readonly [Status[], Status[]];
  try {
    sources = await Promise.all([fromIsDayOff(year), fromXmlCalendar(year)]);
  } catch (error: unknown) {
    if (error instanceof NotPublished && year > PUBLISHED_YEAR) {
      process.stdout.write(`${year}: not published yet
`);
      break;
    }
    throw error;
  }
  const [a, b] = sources;
  let encoded = '';
  for (let index = 0; index < daysInYear(year); index += 1) {
    const date = dateOf(year, index);
    const iso = isoOf(date);
    const override = overrideByDate.get(iso);
    const left = a[index];
    const right = b[index];
    if (left === undefined || right === undefined) throw new Error(`${iso}: missing data`);
    if (override === undefined && left !== right) conflicts.push(`${iso}: isdayoff=${left} xmlcalendar=${right}`);
    const status = isOfficialShort(iso) ? 'short' : (override?.status ?? right);
    encoded += kindOf(date, status, isNonWorking(iso));
  }
  years.push(encoded);
  process.stdout.write(`${year}: ok\n`);
}

if (conflicts.length > 0) {
  process.stderr.write(`Sources disagree; resolve in data/overrides.json:\n${conflicts.join('\n')}\n`);
  process.exit(1);
}

const source = `export const FIRST_YEAR = ${FIRST_YEAR};

export const YEARS: readonly string[] = [
${years.map((year) => `  '${year}',`).join('\n')}
];
`;

writeFileSync(new URL('../src/data.ts', import.meta.url), source);
process.stdout.write(`Wrote ${years.length} years to src/data.ts\n`);
