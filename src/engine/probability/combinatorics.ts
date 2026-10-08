/**
 * Binomial coefficient C(n, k), computed multiplicatively so intermediate
 * values stay small. Exact for every board size used by the games here.
 */
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

/**
 * Hypergeometric P(X = hits): draw `draws` items without replacement from a
 * population of `population` containing `successes` marked items.
 */
export function hypergeometric(population: number, successes: number, draws: number, hits: number): number {
  return (combinations(successes, hits) * combinations(population - successes, draws - hits)) / combinations(population, draws);
}

/** P(X = k) for X ~ Binomial(n, p). */
export function binomial(n: number, k: number, p = 0.5): number {
  return combinations(n, k) * p ** k * (1 - p) ** (n - k);
}

/**
 * Probability that `picks` sequential picks without replacement from `total`
 * items all avoid `bad` items: C(total - bad, picks) / C(total, picks).
 * Computed as a running product to avoid large intermediates.
 */
export function survivalProbability(total: number, bad: number, picks: number): number {
  let p = 1;
  for (let i = 0; i < picks; i++) p *= (total - bad - i) / (total - i);
  return p;
}
