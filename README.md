# Roadmap Impact Calculator 2026

## RU

### Что это за проект

Это калькулятор для оценки влияния roadmap-задач на e-commerce воронку и выручку.

Сервис помогает ответить на простой бизнес-вопрос:

"Если мы внедрим конкретные задачи в конкретные месяцы, как изменятся воронка, заказы, gross revenue и net revenue по году?"

Приложение показывает:

- базовую воронку
- список задач и их влияние
- помесячную модель 2026 года
- среднегодовую воронку
- вклад каждой задачи
- экспорт в Excel
- переключение языка RU / EN
- portable-режим: локальный запуск в браузере без отдельного backend-сервера

### Как это работает простыми словами

Сверху задается база:

- сколько у нас `Sessions`
- какая конверсия между шагами воронки
- какой `ATV`
- какой `Buyout %`
- какой `UPT`

Дальше сервис сам восстанавливает всю воронку:

- сколько дошло до каталога
- сколько дошло до PDP
- сколько добавили в корзину
- сколько дошло до checkout
- сколько стало заказами

После этого внизу добавляются задачи roadmap.

У каждой задачи есть:

- название
- проект / направление
- 1 или 2 зоны влияния
- тип влияния
- величина влияния
- месяц релиза
- флаг активности

Дальше модель идет по каждому месяцу года и смотрит:

- какие задачи уже запущены к этому месяцу
- как они меняют трафик, конверсии и money-метрики
- какой получается результат за месяц

Потом 12 месяцев складываются в итог по году.

### Какая математика внутри

#### 1. Базовая воронка

Пользователь вводит:

- `Sessions`
- `Catalog CR`
- `PDP CR`
- `ATC CR`
- `Checkout CR`
- `Order CR`
- `Buyout Rate`
- `ATV`
- `UPT`

Из этого считаются абсолютные шаги воронки:

```text
Catalog = Sessions * Catalog CR
PDP = Catalog * PDP CR
ATC = PDP * ATC CR
Checkout = ATC * Checkout CR
Orders = Checkout * Order CR
```

Затем считаются money-метрики:

```text
Gross Revenue = Orders * ATV
Order Units = Orders * UPT
ASP = Gross Revenue / Order Units
Net Revenue = Gross Revenue * Buyout Rate
```

#### 2. Что делает задача

Задача может влиять на:

- `traffic`
- `catalog`
- `pdp`
- `atc`
- `checkout`
- `order`
- `atv`
- `buyout`
- `upt`

И есть 3 типа влияния:

- `relative_percent`
- `absolute_pp`
- `absolute_value`

Простое объяснение:

- `relative_percent` означает "умножить текущее значение"
- `absolute_pp` означает "добавить процентные пункты"
- `absolute_value` означает "добавить абсолютное число"

Примеры:

- `+10%` к `Order CR`:
  `newOrderCR = baseOrderCR * 1.10`
- `+2 п.п.` к `Checkout CR`:
  `newCheckoutCR = baseCheckoutCR + 0.02`
- `+150` к `ATV`:
  `newATV = baseATV + 150`

#### 3. Если несколько задач влияют на один и тот же показатель

Для относительного роста эффекты перемножаются:

```text
final = base * (1 + uplift1) * (1 + uplift2)
```

Пример:

- одна задача дает `+10%`
- вторая дает `+20%`

Итог:

```text
base * 1.10 * 1.20 = base * 1.32
```

То есть итоговый рост будет не `30%`, а `32%`.

Для процентных пунктов и абсолютных значений эффекты складываются:

```text
final = base + delta1 + delta2
```

#### 4. Почему важен месяц релиза

Ключевая идея модели:

задача начинает влиять не на весь год, а только с месяца релиза.

Например:

- если задача выходит в январе, она влияет 12 месяцев
- если задача выходит в апреле, она влияет 9 месяцев
- если задача выходит в декабре, она влияет только 1 месяц

Это позволяет честно показать, почему даже сильная задача в конце года может слабо повлиять на годовой итог.

#### 5. Помесячная модель

Каждый год делится на 12 месяцев.

Сейчас в MVP годовая база делится равномерно:

```text
Monthly Sessions = Annual Sessions / 12
```

Для каждого месяца модель делает одно и то же:

1. Берет базу месяца
2. Находит активные к этому месяцу задачи
3. Применяет их влияние
4. Считает новую воронку
5. Считает Gross / Net revenue

Формулы месяца:

```text
Sessions_m = monthly base sessions * traffic multiplier * active traffic effects
Catalog_m = Sessions_m * Catalog CR_m
PDP_m = Catalog_m * PDP CR_m
ATC_m = PDP_m * ATC CR_m
Checkout_m = ATC_m * Checkout CR_m
Orders_m = Checkout_m * Order CR_m
Gross_m = Orders_m * ATV_m
Net_m = Gross_m * Buyout_m
```

#### 6. Что такое среднегодовая воронка

Это важный момент.

Сервис не берет среднее арифметическое месячных конверсий.

Он сначала складывает годовые объемы:

- все `Sessions`
- все `Catalog`
- все `PDP`
- все `ATC`
- все `Checkout`
- все `Orders`

И только потом считает итоговые годовые конверсии.

То есть логика такая:

```text
Annual Catalog CR = Annual Catalog / Annual Sessions
Annual PDP CR = Annual PDP / Annual Catalog
...
```

Это дает более честный и бизнес-корректный результат.

#### 7. Как считается вклад задачи

В интерфейсе используются два понятных подхода.

`Standalone`

Это ответ на вопрос:

"Что даст эта задача сама по себе, если включить только ее?"

Формула:

```text
Standalone Value = Net Revenue with only this task - Base Net Revenue
```

`Incremental`

Это ответ на вопрос:

"Сколько эта задача добавляет поверх уже выбранного roadmap?"

Формула по смыслу:

```text
Incremental Value = Current plan with task - Current plan before this task
```

В проекте этот вклад считается последовательно по порядку roadmap, чтобы вклады задач корректно складывались в общий итог.

### Что видит пользователь

- базу воронки
- эффекты задач
- изменения конверсий
- top tasks по вкладу
- детальную таблицу задач
- среднегодовую воронку
- помесячную модель
- выгрузку в Excel

### Как запустить

Локальная разработка:

```bash
npm install
npm run dev
```

Production / статическая сборка:

```bash
npm run build
npm start
```

Portable-версия, которая открывается в браузере:

```bash
npm run portable:build
```

После этого:

- macOS: `portable/run-macos.command`
- Windows: `portable/run-windows.bat`

### Общий roadmap (Supabase)

Если настроен Supabase (см. `.env.example`), приложение сохраняет и загружает общий roadmap в таблицу `roadmap_state`. Для **real-time** обновлений (когда другой пользователь сохраняет) нужно включить Realtime для этой таблицы:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE roadmap_state;
```

Или в Supabase Dashboard: Database → Publications → `supabase_realtime` → включить `roadmap_state`.

### Ограничения текущей версии

- месячная база сейчас делится равномерно на 12 месяцев
- нет отдельной загрузки помесячного forecast
- влияние задач считается по заданным пользователем гипотезам, а не по ML-модели
- Windows launcher собран, но его лучше отдельно проверить на Windows-машине

---

## EN

### What this project is

This is a calculator for estimating how roadmap initiatives affect an e-commerce funnel and revenue.

It answers a simple business question:

"If we launch specific initiatives in specific months, how will the funnel, orders, gross revenue, and net revenue change over the year?"

The app provides:

- a baseline funnel
- a task list with impact settings
- a monthly 2026 simulation
- an annual average funnel
- task contribution analysis
- Excel export
- RU / EN language switch
- a portable browser-based mode without a separate backend server

### How it works in simple language

At the top, the user sets the baseline:

- how many `Sessions` there are
- what the conversion rate is between each funnel step
- what the `ATV` is
- what the `Buyout %` is
- what the `UPT` is

The service then reconstructs the full funnel automatically:

- how many users reach catalog
- how many reach PDP
- how many add to cart
- how many reach checkout
- how many become orders

Then roadmap initiatives are added below.

Each task contains:

- a name
- a project / stream
- 1 or 2 impact areas
- an impact type
- an impact value
- a release month
- an active toggle

After that, the model goes month by month and checks:

- which tasks are already live in that month
- how they change traffic, conversion rates, and revenue drivers
- what result the month produces

Finally, all 12 months are summed into the annual result.

### Math inside the model

#### 1. Baseline funnel

The user enters:

- `Sessions`
- `Catalog CR`
- `PDP CR`
- `ATC CR`
- `Checkout CR`
- `Order CR`
- `Buyout Rate`
- `ATV`
- `UPT`

From that, the app calculates absolute funnel steps:

```text
Catalog = Sessions * Catalog CR
PDP = Catalog * PDP CR
ATC = PDP * ATC CR
Checkout = ATC * Checkout CR
Orders = Checkout * Order CR
```

Then it calculates money metrics:

```text
Gross Revenue = Orders * ATV
Order Units = Orders * UPT
ASP = Gross Revenue / Order Units
Net Revenue = Gross Revenue * Buyout Rate
```

#### 2. What a task does

A task can affect:

- `traffic`
- `catalog`
- `pdp`
- `atc`
- `checkout`
- `order`
- `atv`
- `buyout`
- `upt`

There are 3 impact types:

- `relative_percent`
- `absolute_pp`
- `absolute_value`

Simple interpretation:

- `relative_percent` means "multiply the current value"
- `absolute_pp` means "add percentage points"
- `absolute_value` means "add an absolute number"

Examples:

- `+10%` to `Order CR`:
  `newOrderCR = baseOrderCR * 1.10`
- `+2 pp` to `Checkout CR`:
  `newCheckoutCR = baseCheckoutCR + 0.02`
- `+150` to `ATV`:
  `newATV = baseATV + 150`

#### 3. If multiple tasks affect the same metric

Relative uplifts are multiplied:

```text
final = base * (1 + uplift1) * (1 + uplift2)
```

Example:

- one task gives `+10%`
- another gives `+20%`

Result:

```text
base * 1.10 * 1.20 = base * 1.32
```

So the total growth is not `30%`, but `32%`.

Percentage points and absolute values are added:

```text
final = base + delta1 + delta2
```

#### 4. Why release month matters

This is the core idea of the model:

a task does not affect the whole year, only the period starting from its release month.

For example:

- January release -> affects 12 months
- April release -> affects 9 months
- December release -> affects only 1 month

This is why even a strong initiative launched late in the year may have only a small annual impact.

#### 5. Monthly model

The year is split into 12 months.

In the current MVP, the annual baseline is distributed evenly:

```text
Monthly Sessions = Annual Sessions / 12
```

For each month, the model:

1. takes the monthly baseline
2. finds tasks active by that month
3. applies their effects
4. recalculates the funnel
5. recalculates gross and net revenue

Monthly formulas:

```text
Sessions_m = monthly base sessions * traffic multiplier * active traffic effects
Catalog_m = Sessions_m * Catalog CR_m
PDP_m = Catalog_m * PDP CR_m
ATC_m = PDP_m * ATC CR_m
Checkout_m = ATC_m * Checkout CR_m
Orders_m = Checkout_m * Order CR_m
Gross_m = Orders_m * ATV_m
Net_m = Gross_m * Buyout_m
```

#### 6. What “annual funnel” means

This is important.

The app does not take the arithmetic mean of monthly conversion rates.

Instead, it first sums annual totals:

- all `Sessions`
- all `Catalog`
- all `PDP`
- all `ATC`
- all `Checkout`
- all `Orders`

Only after that does it calculate the annual conversion rates.

So the logic is:

```text
Annual Catalog CR = Annual Catalog / Annual Sessions
Annual PDP CR = Annual PDP / Annual Catalog
...
```

This gives a more honest and business-correct result.

#### 7. How task value is calculated

The UI uses two understandable views.

`Standalone`

This answers:

"What does this task bring on its own if it is the only enabled task?"

Formula:

```text
Standalone Value = Net Revenue with only this task - Base Net Revenue
```

`Incremental`

This answers:

"How much does this task add on top of the already selected roadmap?"

Meaning:

```text
Incremental Value = Current plan with task - Current plan before this task
```

In this project, the incremental value is calculated sequentially in roadmap order so that task contributions add up correctly to the total plan delta.

### What the user sees

- baseline funnel
- task effects
- conversion changes
- top tasks by contribution
- detailed task table
- annual funnel
- monthly model
- Excel export

### How to run

Local development:

```bash
npm install
npm run dev
```

Production / static build:

```bash
npm run build
npm start
```

Portable browser-based build:

```bash
npm run portable:build
```

After that:

- macOS: `portable/run-macos.command`
- Windows: `portable/run-windows.bat`

### Shared roadmap (Supabase)

If Supabase is configured (see `.env.example`), the app saves and loads the shared roadmap from the `roadmap_state` table. For **real-time** updates when another user saves, enable Realtime for this table:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE roadmap_state;
```

Or in Supabase Dashboard: Database → Publications → `supabase_realtime` → enable `roadmap_state`.

### Current limitations

- the monthly baseline is currently split evenly across 12 months
- there is no separate monthly forecast upload yet
- task impact is based on user-defined assumptions, not an ML model
- the Windows launcher is built, but should be validated on a real Windows machine
