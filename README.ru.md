# prodcal

[English](README.md) · **Русский**

[![JSR](https://jsr.io/badges/@mrprolopstar/prodcal)](https://jsr.io/@mrprolopstar/prodcal)
[![JSR Score](https://jsr.io/badges/@mrprolopstar/prodcal/score)](https://jsr.io/@mrprolopstar/prodcal/score)
[![CI](https://github.com/MrProLopstar/prodcal/actions/workflows/ci.yml/badge.svg)](https://github.com/MrProLopstar/prodcal/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Производственный календарь РФ для TypeScript и JavaScript: рабочие дни, праздники, переносы выходных, сокращённые предпраздничные дни и нормы рабочего времени.

```ts
import { addWorkdays, dayKind, isWorkday, stats, workdaysBetween } from '@mrprolopstar/prodcal';

isWorkday('2026-01-09');                      // false, перенесённый выходной
dayKind('2026-11-03');                        // 'short'
addWorkdays('2026-04-30', 1);                 // '2026-05-04'
workdaysBetween('2026-01-01', '2026-01-31');  // 15
stats(2025).hours;                            // 1972, официальная норма при 40-часовой неделе
```

- Работает офлайн: календарь лежит внутри пакета (около 5 КБ), запросов в сеть нет
- Годы 2013–2026; новый год добавляется автоматически после выхода постановления правительства
- Данные из двух независимых источников, isdayoff.ru и xmlcalendar.ru, сверены по каждому дню; годовые нормы проверены тестами на официальных значениях
- Отличает обычные выходные от нерабочих дней с сохранением зарплаты по указам президента в 2020 и 2021 годах
- Без зависимостей, строгий TypeScript, работает в Node, Deno, Bun и браузере

## Установка

```bash
npx jsr add @mrprolopstar/prodcal
```

```bash
npm install github:MrProLopstar/prodcal
```

## API

| Функция | Что возвращает |
| --- | --- |
| `isWorkday(date)` | `true` для обычных и сокращённых рабочих дней |
| `isDayOff(date)` | Противоположность `isWorkday` |
| `isHoliday(date)` | Нерабочий праздник по статье 112 ТК РФ |
| `isShortDay(date)` | Сокращённый предпраздничный день |
| `dayKind(date)` | `'workday'`, `'short'`, `'weekend'`, `'holiday'`, `'dayoff'` или `'nonworking'` |
| `dayInfo(date)` | `{ date, kind, working, weekday }` |
| `addWorkdays(date, n)` | Дата через `n` рабочих дней, при отрицательном `n` раньше |
| `nextWorkday(date, { inclusive? })` | Следующий рабочий день |
| `previousWorkday(date, { inclusive? })` | Предыдущий рабочий день |
| `workdaysBetween(from, to)` | Число рабочих дней от `from` до `to` включительно |
| `days(year, month?)` | Все дни месяца или года, например для отрисовки календаря |
| `stats(year, month?, { weekHours? })` | Рабочие и выходные дни, праздники и норма часов |
| `firstYear`, `lastYear` | Диапазон лет в данных |

Даты принимаются строкой `YYYY-MM-DD` или объектом `Date` (читается в локальном времени). Результаты возвращаются строками `YYYY-MM-DD`, поэтому часовые пояса не мешают.

Для дат вне диапазона данных библиотека бросает `ProdcalError` с кодом `OUT_OF_RANGE` и ничего не угадывает. На некорректный ввод бросается `INVALID_DATE` или `INVALID_ARGUMENT`.

## Типы дней

| Тип | Значение |
| --- | --- |
| `workday` | Обычный рабочий день, включая рабочие субботы после переноса |
| `short` | Предпраздничный день, короче на час |
| `weekend` | Суббота или воскресенье |
| `holiday` | 1–8 января, 23 февраля, 8 марта, 1 мая, 9 мая, 12 июня, 4 ноября |
| `dayoff` | Будний день, ставший выходным из-за переноса по постановлению правительства |
| `nonworking` | Нерабочий день с сохранением зарплаты по указу президента: весна 2020, май и ноябрь 2021, 24 июня и 1 июля 2020 |

`isWorkday` считает `nonworking` выходными, потому что в эти дни не работали. `stats` следует официальному производственному календарю и учитывает их в норме часов как рабочие, как того требует Минтруд.

## Нормы рабочего времени

`stats(year, month, { weekHours })` считает норму по приказу 588н: `weekHours / 5` часов за каждый рабочий день минус час за каждый сокращённый день.

```ts
stats(2025);                                      // { workdays: 247, hours: 1972, ... }
stats(2025, undefined, { weekHours: 36 }).hours;  // 1774.4
stats(2026, 1);                                   // январь 2026
```

## Данные

`npm run data` скачивает все годы из isdayoff.ru и xmlcalendar.ru и падает, если источники расходятся хотя бы в одном дне. Разобранные расхождения лежат в `data/overrides.json`, нерабочие дни по указам в `data/nonworking.json`, у каждой записи указано правовое основание. Раз в неделю GitHub Actions проверяет источники и открывает pull request, когда публикуется новый год.

## Релизы

**Actions → Release → Run workflow**, затем выбрать `patch`, `minor`, `major` или точную версию. Workflow поднимет версию в `package.json` и `jsr.json`, сделает коммит и тег, прогонит тесты и опубликует пакет в JSR и GitHub Packages вместе с GitHub Release. Вариант `current` выпускает версию, которая уже указана в `package.json`. Push тега `v*` вручную тоже работает.

## Лицензия

MIT
