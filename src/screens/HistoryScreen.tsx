import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Segmented } from "@/components/common/Segmented";
import { T } from "@/components/common/Typography";
import { GameIcon } from "@/components/game/GameIcon";
import { Screen } from "@/components/layout/Screen";
import { listSettledBets, listTransactions, type BetRow } from "@/engine/persistence/storage";
import { formatCoins, formatMultiplier, formatSigned } from "@/engine/wallet/money";
import { resultFor, type Transaction } from "@/engine/wallet/types";
import { GAME_BY_ID, GAMES } from "@/games/registry";
import type { GameId } from "@/games/types";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { haptic } from "@/utils/feedback";
import { formatTime } from "@/utils/format";

const PAGE = 50;

function Filter({ value, onChange }: { value: GameId | null; onChange: (g: GameId | null) => void }) {
  const options: { id: GameId | null; label: string }[] = [{ id: null, label: "All" }, ...GAMES.map((g) => ({ id: g.id, label: g.name }))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 pb-3">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              haptic("select");
              onChange(o.id);
            }}
            className={`border border-white px-3 py-2 ${selected ? "bg-white" : "bg-black"}`}
          >
            <T variant="label" inverted={selected} className="text-[10px]">
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function BetListRow({ bet }: { bet: BetRow }) {
  const result = resultFor(bet.totalBet, bet.payout);
  const profit = bet.payout - bet.totalBet;
  const meta = GAME_BY_ID[bet.game];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.name}, ${result}, ${formatSigned(profit)} coins`}
      onPress={() => router.push({ pathname: "/bet/[id]", params: { id: String(bet.id) } })}
      className="flex-row items-center gap-3 border-b border-white px-4 py-3 active:bg-white"
    >
      {({ pressed }) => (
        <>
          <GameIcon id={bet.game} size={18} color={pressed ? "#000" : "#fff"} />
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <T variant="body" inverted={pressed} className="font-bold">
                {meta.name}
              </T>
              <View className={result === "win" ? "bg-white px-1" : "border border-white px-1"}>
                <T variant="label" inverted={result === "win" ? !pressed : pressed} className="text-[9px]">
                  {result}
                </T>
              </View>
            </View>
            <T variant="monoSm" inverted={pressed} className="text-[10px]">
              {formatTime(bet.createdAt)} · nonce {bet.nonce}
            </T>
          </View>
          <View className="items-end gap-0.5">
            <T variant="mono" inverted={pressed} className="font-mono-bold">
              {formatSigned(profit)}
            </T>
            <T variant="monoSm" inverted={pressed} className="text-[10px]">
              {formatCoins(bet.totalBet)} @ {formatMultiplier(bet.totalBet > 0 ? bet.payout / bet.totalBet : bet.multiplier)}
            </T>
          </View>
        </>
      )}
    </Pressable>
  );
}

const LEDGER_LABELS: Record<Transaction["type"], string> = { BET: "Bet", PAYOUT: "Payout", RESET_BALANCE: "Reset", BONUS: "Bonus" };

function Ledger() {
  const entries = useLiveQuery(() => listTransactions(200));
  return (
    <FlashList
      data={entries}
      keyExtractor={(t) => String(t.id)}
      renderItem={({ item }) => (
        <View className="flex-row items-center gap-3 border-b border-white px-4 py-2.5">
          <View className="flex-1">
            <T variant="label">{LEDGER_LABELS[item.type]}</T>
            <T variant="monoSm" className="text-[10px]">
              {formatTime(item.createdAt)}
              {item.betId ? ` · bet #${item.betId}` : item.note ? ` · ${item.note}` : ""}
            </T>
          </View>
          <View className="items-end">
            <T variant="mono" className="font-mono-bold">
              {formatSigned(item.amount)}
            </T>
            <T variant="monoSm" className="text-[10px]">
              bal {formatCoins(item.balanceAfter)}
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
    <Screen kicker="Bets & ledger" title="History" scroll={false}>
      <View className="px-4 pb-3">
        <Segmented
          accessibilityLabel="History view"
          value={view}
          options={[
            { value: "bets", label: "Bets" },
            { value: "ledger", label: "Ledger" },
          ]}
          onChange={setView}
        />
      </View>
      {view === "ledger" ? (
        <Ledger />
      ) : (
        <>
          <Filter value={game} onChange={setGame} />
          <View className="h-px bg-white" />
          <FlashList
            data={rows}
            keyExtractor={(b) => String(b.id)}
            renderItem={({ item }) => <BetListRow bet={item} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View className="items-center gap-2 px-4 py-16">
                <T variant="heading">No bets yet</T>
                <T variant="small" className="text-center">
                  Finished rounds appear here with everything needed to verify them.
                </T>
              </View>
            }
          />
        </>
      )}
    </Screen>
  );
}
