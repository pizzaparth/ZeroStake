import { router, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn } from "@/components/common/Btn";
import { KeyValue } from "@/components/common/KeyValue";
import { T } from "@/components/common/Typography";
import { VerificationPanel } from "@/components/fairness/VerificationPanel";
import { readBet } from "@/engine/persistence/storage";
import { formatCoins, formatMultiplier, formatSigned } from "@/engine/wallet/money";
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
      <View className="flex-1 items-center justify-center bg-black">
        <T variant="heading">Bet not found</T>
      </View>
    );
  }

  const meta = GAME_BY_ID[bet.game];
  const profit = bet.payout - bet.totalBet;
  const seeds = bet.serverSeed ? { serverSeed: bet.serverSeed, clientSeed: bet.clientSeed, nonce: bet.nonce } : null;

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top || 16 }}>
      <View className="flex-row items-center justify-between border-b-[3px] border-white px-4 pb-3">
        <View>
          <T variant="label">Bet #{bet.id}</T>
          <T variant="title">{meta.name}</T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center border border-white active:bg-white"
        >
          {({ pressed }) => <X size={18} color={pressed ? "#000" : "#fff"} />}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <View className="flex-row gap-3">
          <View className="flex-1 bg-white p-3">
            <T variant="label" inverted>
              Profit
            </T>
            <T variant="mono" inverted className="font-mono-bold text-2xl">
              {formatSigned(profit)}
            </T>
          </View>
          <View className="flex-1 border border-white p-3">
            <T variant="label">Multiplier</T>
            <T variant="mono" className="font-mono-bold text-2xl">
              {formatMultiplier(bet.totalBet > 0 ? bet.payout / bet.totalBet : bet.multiplier)}
            </T>
          </View>
        </View>
        <View>
          <KeyValue label="Result" value={meta.describe(bet.outcome)} mono={false} />
          <KeyValue label="Time" value={formatTime(bet.createdAt)} />
          <KeyValue label="Bet" value={`${formatCoins(bet.totalBet)}${bet.totalBet !== bet.baseBet ? ` (base ${formatCoins(bet.baseBet)})` : ""}`} />
          <KeyValue label="Payout" value={formatCoins(bet.payout)} />
          <KeyValue label="Nonce" value={String(bet.nonce)} copyable />
          <KeyValue label="Client seed" value={bet.clientSeed} copyable />
          <KeyValue label="Server seed hash" value={bet.serverSeedHash} copyable />
          <KeyValue label="Server seed" value={bet.serverSeed ?? "Hidden until you rotate seeds"} copyable={!!bet.serverSeed} />
          <KeyValue label="Parameters" value={JSON.stringify(bet.params)} />
          {bet.actions.length > 0 ? <KeyValue label="Actions" value={JSON.stringify(bet.actions)} /> : null}
        </View>

        {seeds && bet.outcome ? (
          <VerificationPanel
            bet={{ game: bet.game, params: bet.params, actions: bet.actions, outcome: bet.outcome, multiplier: bet.multiplier }}
            seeds={seeds}
            serverSeedHash={bet.serverSeedHash}
          />
        ) : (
          <View className="gap-3 border border-dashed border-white p-4">
            <T variant="heading">Not verifiable yet</T>
            <T variant="small">
              This bet used the active seed pair. Its server seed stays secret so results can’t be predicted. Rotate seeds on the Fairness tab to
              reveal it, then come back to verify.
            </T>
            <Btn label="Go to Fairness" variant="outline" onPress={() => router.navigate("/fairness")} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
