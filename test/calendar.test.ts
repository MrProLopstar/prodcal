import { describe, expect, it } from 'vitest';
import {
  addWorkdays,
  dayInfo,
  dayKind,
  days,
  firstYear,
  isDayOff,
  isHoliday,
  isShortDay,
  isWorkday,
  lastYear,
  nextWorkday,
  previousWorkday,
  ProdcalError,
  stats,
  workdaysBetween,
  type DayKind,
  type ProdcalErrorCode,
} from '../src/index.js';

const OFFICIAL: ReadonlyArray<readonly [number, number, number]> = [
  [2013, 247, 1970],
  [2014, 247, 1970],
  [2015, 247, 1971],
  [2016, 247, 1974],
  [2017, 247, 1973],
  [2018, 247, 1970],
  [2019, 247, 1970],
  [2020, 248, 1979],
  [2021, 247, 1972],
  [2022, 247, 1973],
  [2023, 247, 1973],
  [2024, 248, 1979],
  [2025, 247, 1972],
];

describe('official yearly norms', () => {
  it.each(OFFICIAL)('%i: %i workdays, %i hours', (year, workdays, hours) => {
    const result = stats(year);
    expect(result.workdays).toBe(workdays);
    expect(result.hours).toBe(hours);
    expect(result.calendarDays - result.daysOff).toBe(workdays);
  });

  it('sums months to the year', () => {
    for (let year = firstYear; year <= lastYear; year += 1) {
      const months = Array.from({ length: 12 }, (_, index) => stats(year, index + 1));
      const total = stats(year);
      expect(months.reduce((sum, month) => sum + month.workdays, 0)).toBe(total.workdays);
      expect(months.reduce((sum, month) => sum + month.shortDays, 0)).toBe(total.shortDays);
    }
  });

  it('computes shorter weeks', () => {
    expect(stats(2025, undefined, { weekHours: 36 }).hours).toBe(1774.4);
    expect(stats(2025, undefined, { weekHours: 24 }).hours).toBe(1181.6);
  });

  it('counts 14 public holidays a year', () => {
    for (let year = firstYear; year <= lastYear; year += 1) expect(stats(year).holidays).toBe(14);
  });
});

const KINDS: ReadonlyArray<readonly [string, DayKind]> = [
  ['2026-01-01', 'holiday'],
  ['2026-01-07', 'holiday'],
  ['2026-01-09', 'dayoff'],
  ['2026-01-12', 'workday'],
  ['2026-02-23', 'holiday'],
  ['2026-03-09', 'dayoff'],
  ['2026-04-30', 'short'],
  ['2026-05-09', 'holiday'],
  ['2026-05-11', 'dayoff'],
  ['2026-11-03', 'short'],
  ['2026-12-31', 'dayoff'],
  ['2026-09-26', 'weekend'],
  ['2025-11-01', 'short'],
  ['2024-12-28', 'workday'],
  ['2020-04-15', 'nonworking'],
  ['2020-05-08', 'nonworking'],
  ['2020-07-01', 'nonworking'],
  ['2021-11-02', 'nonworking'],
  ['2021-11-05', 'dayoff'],
];

describe('day kinds', () => {
  it.each(KINDS)('%s is %s', (date, kind) => {
    expect(dayKind(date)).toBe(kind);
    expect(isWorkday(date)).toBe(kind === 'workday' || kind === 'short');
    expect(isDayOff(date)).toBe(!(kind === 'workday' || kind === 'short'));
    expect(isHoliday(date)).toBe(kind === 'holiday');
    expect(isShortDay(date)).toBe(kind === 'short');
  });

  it('accepts Date in local time', () => {
    expect(dayKind(new Date(2026, 0, 9, 23, 59))).toBe('dayoff');
  });

  it('describes a day', () => {
    expect(dayInfo('2026-01-09')).toEqual({ date: '2026-01-09', kind: 'dayoff', working: false, weekday: 5 });
  });

  it('lists days', () => {
    expect(days(2026, 2)).toHaveLength(28);
    expect(days(2024)).toHaveLength(366);
    expect(days(2026, 1).filter((day) => day.working)).toHaveLength(15);
  });
});

describe('workday arithmetic', () => {
  it('moves across holidays', () => {
    expect(addWorkdays('2026-04-30', 1)).toBe('2026-05-04');
    expect(addWorkdays('2026-05-04', -1)).toBe('2026-04-30');
    expect(addWorkdays('2025-12-30', 1)).toBe('2026-01-12');
    expect(addWorkdays('2026-01-01', 0)).toBe('2026-01-01');
    expect(nextWorkday('2026-01-01')).toBe('2026-01-12');
    expect(nextWorkday('2026-01-12', { inclusive: true })).toBe('2026-01-12');
    expect(previousWorkday('2026-01-12')).toBe('2025-12-30');
    expect(previousWorkday('2026-01-05', { inclusive: true })).toBe('2025-12-30');
  });

  it('counts workdays in ranges', () => {
    expect(workdaysBetween('2026-01-01', '2026-01-31')).toBe(15);
    expect(workdaysBetween('2026-01-31', '2026-01-01')).toBe(-15);
    expect(workdaysBetween('2026-01-12', '2026-01-12')).toBe(1);
    expect(workdaysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('keeps addWorkdays and workdaysBetween consistent', () => {
    let state = 20_260_924;
    const next = (): number => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
    for (let run = 0; run < 2000; run += 1) {
      const start = new Date(Date.UTC(2014, 0, 1) + Math.floor(next() * 11 * 365) * 86_400_000).toISOString().slice(0, 10);
      const amount = Math.floor(next() * 120) + 1;
      const end = addWorkdays(start, amount);
      expect(isWorkday(end)).toBe(true);
      expect(workdaysBetween(start, end) - (isWorkday(start) ? 1 : 0)).toBe(amount);
      expect(addWorkdays(end, -amount)).toBe(previousWorkday(start, { inclusive: true }) === start ? start : previousWorkday(start));
    }
  });
});

const failures: ReadonlyArray<readonly [() => unknown, ProdcalErrorCode]> = [
  [() => dayKind('2026-02-30'), 'INVALID_DATE'],
  [() => dayKind('2026-1-5'), 'INVALID_DATE'],
  [() => dayKind(new Date(Number.NaN)), 'INVALID_DATE'],
  [() => dayKind('2012-12-31'), 'OUT_OF_RANGE'],
  [() => dayKind(`${lastYear + 1}-01-01`), 'OUT_OF_RANGE'],
  [() => addWorkdays(`${lastYear}-12-30`, 10), 'OUT_OF_RANGE'],
  [() => addWorkdays('2026-01-01', 1.5), 'INVALID_ARGUMENT'],
  [() => stats(2026, 13), 'INVALID_ARGUMENT'],
  [() => stats(2026, undefined, { weekHours: 0 }), 'INVALID_ARGUMENT'],
  [() => stats(2026, undefined, { weekHours: 41 }), 'INVALID_ARGUMENT'],
];

describe('errors', () => {
  it.each(failures.map((entry, index) => [index, ...entry] as const))('#%i throws %s', (_, run, code) => {
    expect(run).toThrow(ProdcalError);
    try {
      run();
    } catch (error: unknown) {
      expect(error instanceof ProdcalError && error.code).toBe(code);
    }
  });
});
