# Regression Test Cases

## Расчёт эффекта задач

Запуск автотестов:

```bash
npm test
```

Фокусные проверки после изменений в модели расчёта:

- `+10% traffic` и `+10% buyout` могут давать одинаковый `Net revenue` uplift. Это валидно: оба эффекта являются мультипликаторами итогового `Net revenue`.
- При `+10% traffic` должны расти `sessions`, `orders`, `grossRevenue` и `netRevenue`; `buyoutRate` должен оставаться базовым.
- При `+10% buyout` должны расти только `buyoutRate` и `netRevenue`; `sessions`, `orders` и `grossRevenue` должны оставаться базовыми.
- `buyout +10% relative_percent` и `buyout +10 п.п. absolute_pp` не равны: первый умножает базовый buyout, второй прибавляет процентные пункты.
- `valuePerYearIgnoreRelease` считается как сценарий с релизом задачи в январе, а не как `valuePerMonth * 12`.

Эти кейсы покрыты в `src/lib/calculations.test.ts`.
