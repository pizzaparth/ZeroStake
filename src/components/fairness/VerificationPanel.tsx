import { useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { KeyValue } from "@/components/common/KeyValue";
import { T } from "@/components/common/Typography";
import { traceRng } from "@/engine/rng/verifier";
import type { SeedInput } from "@/engine/rng/types";
import { canonical, verifyBet, type RecordedBet } from "@/games/verify";

/**
 * Recomputes a bet from its seeds and shows every step: HMAC, bytes, floats,
 * derived outcome, and whether it matches what was recorded.
 */
export function VerificationPanel({ bet, seeds, serverSeedHash }: { bet: RecordedBet; seeds: SeedInput; serverSeedHash?: string }) {
  const report = useMemo(() => verifyBet(bet, seeds, serverSeedHash), [bet, seeds, serverSeedHash]);
  const trace = useMemo(() => traceRng(seeds, 3), [seeds]);

  return (
    <Animated.View entering={FadeIn} className="gap-4">
      <View className={`items-center gap-1 p-4 ${report.verified ? "bg-white" : "border-4 border-dashed border-white"}`}>
        <T variant="title" inverted={report.verified} accessibilityLiveRegion="polite">
          {report.verified ? "VERIFIED ✓" : "VERIFICATION FAILED"}
        </T>
        <T variant="label" inverted={report.verified} className="text-center">
          {report.verified ? "Recomputed result matches the recorded result" : (report.error ?? "Recomputed result differs from the record")}
        </T>
      </View>

      <View className="gap-1">
        <Check label="Server seed matches committed hash" ok={report.commitmentValid} />
        <Check label="Outcome matches" ok={report.outcomeMatches} />
        <Check label="Multiplier matches" ok={report.multiplierMatches} />
      </View>

      <View>
        <T variant="label">RNG derivation (first cursors)</T>
        {trace.map((row) => (
          <View key={row.cursor} className="gap-0.5 border-b border-white py-2">
            <T variant="monoSm">{`HMAC_SHA256(serverSeed, "${row.message}")`}</T>
            <T variant="monoSm" selectable className="text-[10px]">
              {row.hmac}
            </T>
            <T variant="monoSm">
              bytes {row.bytes} → {row.float.toFixed(10)}
            </T>
          </View>
        ))}
      </View>

      <KeyValue label="Expected game result" value={report.expected ? canonical(report.expected.outcome) : "—"} />
      <KeyValue label="Recorded game result" value={canonical(bet.outcome)} />
      <KeyValue label="Expected multiplier" value={report.expected ? String(report.expected.multiplier) : "—"} />
      <KeyValue label="Recorded multiplier" value={String(bet.multiplier)} />
    </Animated.View>
  );
}

function Check({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <View className="flex-row items-center justify-between border-b border-white py-2">
      <T variant="small">{label}</T>
      <T variant="label">{ok === null ? "n/a" : ok ? "✓ yes" : "✕ no"}</T>
    </View>
  );
}
