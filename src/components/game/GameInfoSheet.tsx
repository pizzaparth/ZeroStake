import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BottomSheet } from "heroui-native";
import { View } from "react-native";

import { formatHouseEdge, formatRtp, type GameMeta } from "@/games/registry";
import { StatTile } from "../common/KeyValue";
import { T } from "../common/Typography";

function Block({ title, children }: { title: string; children: string }) {
  return (
    <View className="gap-1.5">
      <T variant="heading" className="text-lg">
        {title}
      </T>
      <T variant="body" className="text-soft">
        {children}
      </T>
    </View>
  );
}

/** Per-game information panel: rules, RTP, house edge, probability model, verification. */
export function GameInfoSheet({ game, open, onOpenChange }: { game: GameMeta; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <BottomSheet isOpen={open} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["70%", "92%"]}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
          backgroundClassName="bg-page rounded-t-[28px]"
          handleIndicatorClassName="bg-line w-10"
        >
          <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 20 }}>
            <BottomSheet.Title className="font-display text-[32px] text-ink">How {game.name} works</BottomSheet.Title>
            <View className="flex-row gap-3">
              <StatTile label="Return to player" value={formatRtp(game.info.rtp)} tone="mint" />
              <StatTile label="House edge" value={formatHouseEdge(game.info.rtp)} tone="red" />
            </View>
            {game.info.rtpNote ? <T variant="small">{game.info.rtpNote}</T> : null}
            <Block title="Rules">{game.info.howToPlay}</Block>
            <Block title="The odds">{game.info.probabilityModel}</Block>
            <Block title="Checking a result">
              {`Each number comes from HMAC-SHA256(server seed, "client seed:nonce:cursor"). The first 4 bytes ÷ 2³² give a value between 0 and 1. ${game.info.rngUsage} After you rotate seeds on the Fairness tab, any round can be recomputed.`}
            </Block>
            <T variant="small">Return to player is a long-run average, not a promise. No strategy changes the house edge. Coins are fictional.</T>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
