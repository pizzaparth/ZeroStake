import { floorTo } from "./houseEdge";

/**
 * Sampling helpers. All take a `floatAt(i)` callback that returns the i-th
 * float for this sampling step, so callers decide which RNG cursors are used
 * and existing cursor layouts from the original engine stay reproducible.
 */

/**
 * Full Fisher–Yates shuffle of [0, n). Step s (s = 0…n-2) swaps index
 * i = n-1-s with j = floor(floatAt(s) × (i+1)).
 */
export function fisherYatesShuffle(n: number, floatAt: (step: number) => number): number[] {
  const items = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(floatAt(n - 1 - i) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Draws k distinct values from [0, n) without replacement (partial
 * Fisher–Yates). Step i picks index floor(floatAt(i) × (n−i)) from the
 * remaining pool and fills the hole with the pool's last live element.
 */
export function sampleWithoutReplacement(n: number, k: number, floatAt: (step: number) => number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  const drawn: number[] = [];
  for (let i = 0; i < k; i++) {
    const j = Math.floor(floatAt(i) * (n - i));
    drawn.push(pool[j]);
    pool[j] = pool[n - 1 - i];
  }
  return drawn;
}

/**
 * Scales a payout table's *shape* so its expected return equals `rtp`:
 *   Σ probabilities[i] × table[i] = rtp
 * then truncates each entry to `decimals` places.
 *
 * Truncation alone can lose up to one step × P(outcome) of return (≈0.9% on
 * a Plinko centre bucket), so the shortfall is handed back greedily: one
 * step at a time to the most likely paying outcome that still keeps the
 * total ≤ rtp. Outcomes with equal shape and probability (Plinko's mirrored
 * buckets) move together so tables stay symmetric. Result: RTP at or just
 * below target, never above.
 *
 * This is how Keno and Plinko tables are derived: the shape (which outcomes
 * pay more) is a design choice, the absolute level is pure arithmetic.
 */
export function scalePayoutTable(probabilities: number[], shape: number[], rtp: number, decimals = 2): number[] {
  if (probabilities.length !== shape.length) {
    throw new Error(`Table length ${shape.length} does not match ${probabilities.length} outcomes`);
  }
  const shapeReturn = tableReturn(probabilities, shape);
  if (shapeReturn <= 0) throw new Error("Payout table shape has no positive return");
  const scale = rtp / shapeReturn;
  const table = shape.map((m) => floorTo(m * scale, decimals));

  const step = 10 ** -decimals;
  const groups = new Map<string, number[]>();
  shape.forEach((m, i) => {
    if (m <= 0) return;
    const key = `${m}|${probabilities[i].toPrecision(12)}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const ordered = [...groups.values()].sort((a, b) => probabilities[b[0]] * b.length - probabilities[a[0]] * a.length);

  let total = tableReturn(probabilities, table);
  for (let changed = true; changed;) {
    changed = false;
    for (const group of ordered) {
      const cost = step * probabilities[group[0]] * group.length;
      if (total + cost <= rtp + 1e-12) {
        for (const i of group) table[i] = Number((table[i] + step).toFixed(decimals));
        total += cost;
        changed = true;
        break;
      }
    }
  }
  return table;
}

export function tableReturn(probabilities: number[], table: number[]): number {
  return table.reduce((sum, m, i) => sum + m * probabilities[i], 0);
}
