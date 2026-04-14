/** Доли годовых sessions по месяцам (индекс 0 = январь). После нормализации сумма = 1. */

export function normalizeSeasonalityWeights(input: number[] | undefined | null): number[] {
  if (!input || input.length !== 12) {
    return uniformSeasonalityWeights();
  }
  const positives = input.map((v) =>
    Number.isFinite(v) && v > 0 ? v : 0,
  );
  const total = positives.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return uniformSeasonalityWeights();
  }
  return positives.map((v) => v / total);
}

export function uniformSeasonalityWeights(): number[] {
  return Array.from({ length: 12 }, () => 1 / 12);
}
