import { CheckCircle2, XCircle } from "lucide-react-native";
import { useMemo } from "react";
import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { KeyValue } from "@/components/common/KeyValue";
import { T } from "@/components/common/Typography";
import { C, CHIPS } from "@/config/theme";
import { traceRng } from "@/engine/rng/verifier";
import type { SeedInput } from "@/engine/rng/types";
import { canonical, verifyBet, type RecordedBet } from "@/games/verify";

/**
 * Recomputes a bet from its seeds and shows every step: HMAC, bytes, floats,
 * the result it should have had, and whether that matches the record.
 */
export function VerificationPanel({ bet, seeds, serverSeedHash }: { bet: RecordedBet; seeds: SeedInput; serverSeedHash?: string }) {
  const report = useMemo(() => verifyBet(bet, seeds, serverSeedHash), [bet, seeds, serverSeedHash]);
  const trace = useMemo(() => traceRng(seeds, 3), [seeds]);
  const chip = CHIPS[report.verified ? "mint" : "red"];

  return (
    <View className="gap-4">
      <Animated.View entering={ZoomIn.duration(180)} className="items-center gap-1 rounded-[20px] p-5" style={{ backgroundColor: chip.fill }}>
        <T variant="title" style={{ color: chip.text }} accessibilityLiveRegion="polite">
          {report.verified ? "VERIFIED ✓" : "VERIFICATION FAILED"}
        </T>
        <T variant="body" className="text-center" style={{ color: chip.text }}>
          {report.verified
            ? "Recomputing from the seeds gives exactly the recorded result."
            : (report.error ?? "Recomputing from the seeds gives a different result.")}
        </T>
      </Animated.View>

      <View className="rounded-[20px] bg-surface px-4 py-1">
        <Check label="Server seed matches the hash you were shown" ok={report.commitmentValid} />
        <Check label="Result matches" ok={report.outcomeMatches} />
        <Check label="Multiplier matches" ok={report.multiplierMatches} last />
      </View>

      <View className="gap-2 rounded-[20px] bg-surface p-4">
        <T variant="heading">Random numbers used</T>
        {trace.map((row) => (
          <View key={row.cursor} className="gap-1 rounded-2xl bg-well p-3">
            <T variant="numSm">{`HMAC_SHA256(serverSeed, "${row.message}")`}</T>
            <T variant="num" selectable className="text-[11px] leading-4">
              {row.hmac}
            </T>
            <T variant="num" className="font-display text-ink">
              {row.bytes} → {row.float.toFixed(10)}
            </T>
          </View>
        ))}
      </View>

      <View className="rounded-[20px] bg-surface px-4 py-1">
        <KeyValue label="Expected result" value={report.expected ? canonical(report.expected.outcome) : "—"} />
        <KeyValue label="Recorded result" value={canonical(bet.outcome)} />
        <KeyValue label="Expected multiplier" value={report.expected ? String(report.expected.multiplier) : "—"} />
        <KeyValue label="Recorded multiplier" value={String(bet.multiplier)} />
      </View>
    </View>
  );
}

function Check({ label, ok, last }: { label: string; ok: boolean | null; last?: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-line"}`}>
      {ok === false ? <XCircle size={20} color={C.neg} /> : <CheckCircle2 size={20} color={ok === null ? C.soft : C.pos} />}
      <T variant="body" className="flex-1">
        {label}
      </T>
      <T variant="label">{ok === null ? "Not checked" : ok ? "Yes" : "No"}</T>
    </View>
  );
}
