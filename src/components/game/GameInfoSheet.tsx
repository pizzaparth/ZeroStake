import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BottomSheet } from "heroui-native";
import { View } from "react-native";

import { formatHouseEdge, formatRtp, type GameMeta } from "@/games/registry";
import { T } from "../common/Typography";

function Block({ title, children }: { title: string; children: string }) {
  return (
    <View className="gap-1.5 border-t border-white pt-3">
      <T variant="label">{title}</T>
      <T variant="small">{children}</T>
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
          backgroundClassName="bg-black border-t-[3px] border-white"
          handleIndicatorClassName="bg-white"
        >
          <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 16 }}>
            <View className="gap-1">
              <T variant="label">Game info</T>
              <BottomSheet.Title className="text-3xl font-black tracking-tight text-white">{game.name}</BottomSheet.Title>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white p-3">
                <T variant="label" inverted>
                  Theoretical RTP
                </T>
                <T variant="mono" inverted className="font-mono-bold text-xl">
                  {formatRtp(game.info.rtp)}
                </T>
              </View>
              <View className="flex-1 border border-white p-3">
                <T variant="label">House edge</T>
                <T variant="mono" className="font-mono-bold text-xl">
                  {formatHouseEdge(game.info.rtp)}
                </T>
              </View>
            </View>
            {game.info.rtpNote ? <T variant="monoSm">{game.info.rtpNote}</T> : null}
            <Block title="How to play">{game.info.howToPlay}</Block>
            <Block title="Probability model">{game.info.probabilityModel}</Block>
            <Block title="Verifiable RNG">
              {`HMAC-SHA256(serverSeed, "clientSeed:nonce:cursor"); the first 4 bytes ÷ 2³² give a float in [0, 1). ${game.info.rngUsage} Every round can be recomputed from its seeds on the Fairness tab once the server seed is rotated and revealed.`}
            </Block>
            <Block title="Disclaimer">
              RTP is a long-run average, not a promise. Results are random and no strategy changes the house edge. Coins are fictional.
            </Block>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
