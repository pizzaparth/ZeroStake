import { router, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn } from "@/components/common/Btn";
import { KeyValue } from "@/components/common/KeyValue";
import { PressableScale } from "@/components/common/PressableScale";
import { T } from "@/components/common/Typography";
import { VerificationPanel } from "@/components/fairness/VerificationPanel";
import { readBet } from "@/engine/persistence/storage";
import { formatCoins, formatMultiplier, formatSigned } from "@/engine/wallet/money";
import { GAME_CHIP, GameIcon } from "@/components/game/GameIcon";
import { C, CHIPS } from "@/config/theme";
import { GAME_BY_ID } from "@/games/registry";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { formatTime } from "@/utils/format";

/** One bet: details, and full verification once its server seed is revealed. */
export default function BetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  // Re-read after rotation so a newly revealed seed shows up.
  const bet = useLiveQuery(() => readBet(Number(id)), id);

  if (!bet) {
    return (
      <View className="flex-1 items-center justify-center bg-page">
        <T variant="heading">Bet not found</T>
      </View>
    );
  }

  const meta = GAME_BY_ID[bet.game];
  const profit = bet.payout - bet.totalBet;
  const seeds = bet.serverSeed ? { serverSeed: bet.serverSeed, clientSeed: bet.clientSeed, nonce: bet.nonce } : null;

  const chip = CHIPS[profit > 0 ? "mint" : profit === 0 ? "gold" : "red"];
  const gameChip = CHIPS[GAME_CHIP[bet.game]];

  return (
    <View className="flex-1 bg-page" style={{ paddingTop: insets.top || 16 }}>
      <View className="flex-row items-center gap-3 px-5 pb-4">
        <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: gameChip.fill }}>
          <GameIcon id={bet.game} size={22} color={gameChip.text} />
        </View>
        <View className="flex-1">
          <T variant="title">{meta.name}</T>
          <T variant="small">
            Bet {bet.id}, {formatTime(bet.createdAt)}
          </T>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => requestAnimationFrame(() => router.back())}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <X size={20} color={C.ink} />
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-3xl p-4" style={{ backgroundColor: chip.fill }}>
            <T variant="label" style={{ color: chip.text }}>
              {profit > 0 ? "Won" : profit === 0 ? "Stake back" : "Lost"}
            </T>
            <T variant="numLg" style={{ color: chip.text }} numberOfLines={1} adjustsFontSizeToFit>
              {formatSigned(profit)}
            </T>
          </View>
          <View className="flex-1 rounded-3xl bg-surface p-4">
            <T variant="label">Multiplier</T>
            <T variant="numLg">{formatMultiplier(bet.totalBet > 0 ? bet.payout / bet.totalBet : bet.multiplier)}</T>
          </View>
        </View>
        <View className="rounded-3xl bg-surface px-4 py-1">
          <KeyValue label="What happened" value={meta.describe(bet.outcome)} mono={false} />
          <KeyValue label="Bet" value={`${formatCoins(bet.totalBet)}${bet.totalBet !== bet.baseBet ? ` (base ${formatCoins(bet.baseBet)})` : ""}`} />
          <KeyValue label="Paid out" value={formatCoins(bet.payout)} />
          <KeyValue label="Nonce" value={String(bet.nonce)} copyable />
          <KeyValue label="Client seed" value={bet.clientSeed} copyable />
          <KeyValue label="Server seed hash" value={bet.serverSeedHash} copyable />
          <KeyValue label="Server seed" value={bet.serverSeed ?? "Hidden until you rotate seeds"} copyable={!!bet.serverSeed} />
          <KeyValue label="Bet settings" value={JSON.stringify(bet.params)} copyable />
          {bet.actions.length > 0 ? <KeyValue label="Your moves" value={JSON.stringify(bet.actions)} copyable last /> : null}
        </View>

        {seeds && bet.outcome ? (
          <VerificationPanel
            bet={{ game: bet.game, params: bet.params, actions: bet.actions, outcome: bet.outcome, multiplier: bet.multiplier }}
            seeds={seeds}
            serverSeedHash={bet.serverSeedHash}
          />
        ) : (
          <View className="gap-3 rounded-3xl border-2 border-dashed border-line p-5">
            <T variant="heading">Can’t check this one yet</T>
            <T variant="body" className="text-soft">
              This bet used the seeds you’re still playing with. The server seed stays hidden so results can’t be predicted. Rotate seeds on the
              Fairness tab, then come back here to check it.
            </T>
            <Btn label="Open Fairness" variant="outline" onPress={() => requestAnimationFrame(() => router.navigate("/fairness"))} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
