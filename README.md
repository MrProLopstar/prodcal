# prodcal

**English** · [Русский](README.ru.md)

[![JSR](https://jsr.io/badges/@mrprolopstar/prodcal)](https://jsr.io/@mrprolopstar/prodcal)
[![JSR Score](https://jsr.io/badges/@mrprolopstar/prodcal/score)](https://jsr.io/@mrprolopstar/prodcal/score)
[![CI](https://github.com/MrProLopstar/prodcal/actions/workflows/ci.yml/badge.svg)](https://github.com/MrProLopstar/prodcal/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Russian production calendar (производственный календарь РФ) for TypeScript and JavaScript: working days, public holidays, transferred days off, shortened pre-holiday days and working-hour norms.

```ts
import { addWorkdays, dayKind, isWorkday, stats, workdaysBetween } from '@mrprolopstar/prodcal';

isWorkday('2026-01-09');                      // false, a transferred day off
dayKind('2026-11-03');                        // 'short'
addWorkdays('2026-04-30', 1);                 // '2026-05-04'
workdaysBetween('2026-01-01', '2026-01-31');  // 15
stats(2025).hours;                            // 1972, the official norm for a 40-hour week
```

- Works offline: the calendar is bundled, about 5 KB, no API calls at runtime
- Covers 2013–2026, new years arrive automatically once the Government Decree is published
- Two independent sources, isdayoff.ru and xmlcalendar.ru, compared day by day; yearly norms are tested against the official figures
- Distinguishes regular days off from the paid non-working days of 2020 and 2021 introduced by presidential decrees
- No dependencies, strict TypeScript, runs in Node, Deno, Bun and browsers

## Install

```bash
npx jsr add @mrprolopstar/prodcal
```

```bash
npm install github:MrProLopstar/prodcal
```

## API

| Function | Result |
| --- | --- |
| `isWorkday(date)` | `true` for regular and shortened working days |
| `isDayOff(date)` | The opposite of `isWorkday` |
| `isHoliday(date)` | Public holiday under Article 112 of the Labour Code |
| `isShortDay(date)` | Shortened pre-holiday working day |
| `dayKind(date)` | `'workday'`, `'short'`, `'weekend'`, `'holiday'`, `'dayoff'` or `'nonworking'` |
| `dayInfo(date)` | `{ date, kind, working, weekday }` |
| `addWorkdays(date, n)` | Date `n` working days later, or earlier when `n` is negative |
| `nextWorkday(date, { inclusive? })` | Next working day |
| `previousWorkday(date, { inclusive? })` | Previous working day |
| `workdaysBetween(from, to)` | Working days from `from` to `to`, both inclusive |
| `days(year, month?)` | Every day of a month or year, for rendering calendars |
| `stats(year, month?, { weekHours? })` | Workdays, days off, holidays and the working-hour norm |
| `firstYear`, `lastYear` | Range of the bundled data |

Dates are `YYYY-MM-DD` strings or `Date` objects read in local time. Results are `YYYY-MM-DD` strings, so there are no time zone surprises.

Dates outside the bundled years throw `ProdcalError` with code `OUT_OF_RANGE` instead of guessing. Invalid input throws `INVALID_DATE` or `INVALID_ARGUMENT`.

## Kinds of days

| Kind | Meaning |
| --- | --- |
| `workday` | Regular working day, including working Saturdays after a transfer |
| `short` | Pre-holiday working day, one hour shorter |
| `weekend` | Saturday or Sunday |
| `holiday` | January 1–8, February 23, March 8, May 1, May 9, June 12, November 4 |
| `dayoff` | Weekday off moved from another date by a Government Decree |
| `nonworking` | Paid non-working day by presidential decree: spring 2020, May and November 2021, June 24 and July 1, 2020 |

`isWorkday` treats `nonworking` days as days off, because nobody worked on them. `stats` follows the official production calendar and counts them as working days for the hour norm, as the Ministry of Labour requires.

## Working-hour norms

`stats(year, month, { weekHours })` computes the norm as in Order 588n: `weekHours / 5` hours for every working day, minus one hour for every shortened day.

```ts
stats(2025);                          // { workdays: 247, hours: 1972, ... }
stats(2025, undefined, { weekHours: 36 }).hours;  // 1774.4
stats(2026, 1);                       // January 2026
```

## Data

`npm run data` downloads every year from isdayoff.ru and xmlcalendar.ru and fails if the two disagree on any day. Resolved disagreements live in `data/overrides.json` and presidential non-working days in `data/nonworking.json`, each with the legal basis. A weekly GitHub Actions job opens a pull request when a new year is published.

## Releasing

Run **Actions → Release → Run workflow** and pick `patch`, `minor`, `major` or an exact version. The workflow bumps `package.json` and `jsr.json`, commits, tags, runs the tests and publishes to JSR and GitHub Packages with a GitHub release. Use `current` to release the version already in `package.json`. Pushing a `v*` tag by hand works too.

## License

MIT
