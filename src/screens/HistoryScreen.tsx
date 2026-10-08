import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { ChipCoin } from "@/components/common/ChipCoin";
import { Segmented } from "@/components/common/Segmented";
import { PressableScale } from "@/components/common/PressableScale";
import { T } from "@/components/common/Typography";
import { GAME_CHIP, GameIcon } from "@/components/game/GameIcon";
import { Screen } from "@/components/layout/Screen";
import { CHIPS } from "@/config/theme";
import { listSettledBets, listTransactions, type BetRow } from "@/engine/persistence/storage";
import { formatCoins, formatMultiplier, formatSigned } from "@/engine/wallet/money";
import { resultFor, type Transaction } from "@/engine/wallet/types";
import { GAME_BY_ID, GAMES } from "@/games/registry";
import type { GameId } from "@/games/types";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { haptic } from "@/utils/feedback";
import { formatTime } from "@/utils/format";

const PAGE = 50;
const LIST_PADDING = { paddingHorizontal: 20, paddingBottom: 120 };

function Filter({ value, onChange }: { value: GameId | null; onChange: (g: GameId | null) => void }) {
  const options: { id: GameId | null; label: string }[] = [{ id: null, label: "All games" }, ...GAMES.map((g) => ({ id: g.id, label: g.name }))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerClassName="gap-2 px-5 pb-3">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <PressableScale
            key={o.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              haptic("select");
              onChange(o.id);
            }}
            className={`h-9 justify-center rounded-full px-4 ${selected ? "bg-ink" : "bg-surface"}`}
          >
            <T variant="label" numberOfLines={1} className={`text-[13px] ${selected ? "text-page" : "text-ink"}`}>
              {o.label}
            </T>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const RESULT_TEXT = { win: "Won", loss: "Lost", push: "Stake back" } as const;

export function BetListRow({ bet }: { bet: BetRow }) {
  const result = resultFor(bet.totalBet, bet.payout);
  const profit = bet.payout - bet.totalBet;
  const meta = GAME_BY_ID[bet.game];
  const chip = CHIPS[GAME_CHIP[bet.game]];
  const tone = result === "win" ? "text-pos" : result === "loss" ? "text-neg" : "text-soft";
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${meta.name}, ${RESULT_TEXT[result]}, ${formatSigned(profit)} coins`}
      onPress={() => {
        requestAnimationFrame(() => {
          router.push({ pathname: "/bet/[id]", params: { id: String(bet.id) } });
        });
      }}
      className="mb-2 flex-row items-center gap-3 rounded-3xl bg-surface px-3.5 py-3"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: chip.fill }}>
        <GameIcon id={bet.game} size={20} color={chip.text} />
      </View>
      <View className="flex-1 gap-0.5">
        <T variant="body" className="font-body-bold">
          {meta.name}
        </T>
        <T variant="small" className="text-xs">
          {formatTime(bet.createdAt)}, nonce {bet.nonce}
        </T>
      </View>
      <View className="items-end gap-0.5">
        <T variant="num" className={`font-body-bold ${tone}`}>
          {formatSigned(profit)}
        </T>
        <T variant="small" className="text-xs">
          {RESULT_TEXT[result]} at {formatMultiplier(bet.totalBet > 0 ? bet.payout / bet.totalBet : bet.multiplier)}
        </T>
      </View>
    </PressableScale>
  );
}

const LEDGER_LABELS: Record<Transaction["type"], string> = { BET: "Bet placed", PAYOUT: "Paid out", RESET_BALANCE: "Balance reset", BONUS: "Bonus" };

function Ledger() {
  const entries = useLiveQuery(() => listTransactions(200));
  return (
    <FlashList
      data={entries}
      keyExtractor={(t) => String(t.id)}
      contentContainerStyle={LIST_PADDING}
      renderItem={({ item }) => (
        <View className="flex-row items-center gap-3 border-b border-line py-3">
          <View className="flex-1">
            <T variant="body" className="font-body-bold">
              {LEDGER_LABELS[item.type]}
            </T>
            <T variant="small" className="text-xs">
              {formatTime(item.createdAt)}
              {item.betId ? `, bet ${item.betId}` : item.note ? `, ${item.note}` : ""}
            </T>
          </View>
          <View className="items-end">
            <T variant="num" className={`font-body-bold ${item.amount >= 0 ? "text-pos" : "text-ink"}`}>
              {formatSigned(item.amount)}
            </T>
            <T variant="small" className="text-xs">
              Balance {formatCoins(item.balanceAfter)}
            </T>
          </View>
        </View>
      )}
    />
  );
}

export default function HistoryScreen() {
  const [view, setView] = useState<"bets" | "ledger">("bets");
  const [game, setGame] = useState<GameId | null>(null);
  const first = useLiveQuery(() => listSettledBets({ limit: PAGE, offset: 0, game }), game);
  // Extra pages belong to one specific first page; a new query discards them.
  const [extra, setExtra] = useState<{ base: BetRow[]; rows: BetRow[]; done: boolean }>({ base: [], rows: [], done: false });
  const pages = extra.base === first ? extra : { base: first, rows: [], done: first.length < PAGE };
  const rows = pages.rows.length ? [...first, ...pages.rows] : first;

  const loadMore = () => {
    if (pages.done) return;
    const more = listSettledBets({ limit: PAGE, offset: rows.length, game });
    setExtra({ base: first, rows: [...pages.rows, ...more], done: more.length < PAGE });
  };

  return (
    <Screen title="History" subtitle="Tap a bet to see how it was decided." scroll={false}>
      <View className="px-5 pb-3">
        <Segmented
          accessibilityLabel="History view"
          value={view}
          options={[
            { value: "bets", label: "Bets" },
            { value: "ledger", label: "Coin ledger" },
          ]}
          onChange={setView}
        />
      </View>
      {view === "ledger" ? (
        <Ledger />
      ) : (
        <View className="flex-1">
          <Filter value={game} onChange={setGame} />
          <FlashList
            data={rows}
            keyExtractor={(b) => String(b.id)}
            contentContainerStyle={LIST_PADDING}
            renderItem={({ item }) => <BetListRow bet={item} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View className="items-center gap-3 py-16">
                <View className="flex-row -space-x-2">
                  <ChipCoin size={40} color="red" />
                  <ChipCoin size={40} color="blue" />
                  <ChipCoin size={40} color="gold" />
                </View>
                <T variant="heading">No bets yet</T>
                <T variant="small" className="text-center">
                  Play any game from the lobby and each round lands here.
                </T>
              </View>
            }
          />
        </View>
      )}
    </Screen>
  );
}
