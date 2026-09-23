/**
 * # prodcal
 *
 * The Russian production calendar for TypeScript and JavaScript: working days, public holidays,
 * transferred days off, shortened pre-holiday days and working-hour norms. Works offline, has no
 * dependencies, and runs in Node, Deno, Bun and browsers.
 *
 * ```ts
 * import { addWorkdays, dayKind, isWorkday, stats, workdaysBetween } from '@mrprolopstar/prodcal';
 *
 * isWorkday('2026-01-09');                   // false, a transferred day off
 * dayKind('2026-11-03');                     // 'short'
 * addWorkdays('2026-04-30', 1);              // '2026-05-04'
 * workdaysBetween('2026-05-01', '2026-05-31');
 * stats(2026).hours;                         // yearly norm for a 40-hour week
 * ```
 *
 * Data from isdayoff.ru and xmlcalendar.ru, compared day by day. Dates outside the bundled years throw `ProdcalError`.
 *
 * @module
 */
export {
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
  type DateInput,
  type DayInfo,
  type DayKind,
  type HoursOptions,
  type PeriodStats,
  type ProdcalErrorCode,
} from './calendar.js';
