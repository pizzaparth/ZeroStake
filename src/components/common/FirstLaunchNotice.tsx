import { CloudOff, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_NAME, DISCLAIMER } from "@/config/app";
import { C } from "@/config/theme";
import { formatCoins } from "@/engine/wallet/money";
import { useAppStore } from "@/store/appStore";
import { Btn } from "./Btn";
import { ChipCoin } from "./ChipCoin";
import { T } from "./Typography";

function Point({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <View className="flex-row gap-3.5">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface">
        <Icon size={20} color={C.ink} />
      </View>
      <View className="flex-1 gap-0.5">
        <T variant="heading">{title}</T>
        <T variant="small">{body}</T>
      </View>
    </View>
  );
}

/** Full-screen welcome shown once, before the app (store-safe play-money notice). */
export function FirstLaunchNotice() {
  const insets = useSafeAreaInsets();
  const balance = useAppStore((s) => s.balance);
  const updateSetting = useAppStore((s) => s.updateSetting);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      className="flex-1 justify-between bg-page px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 20 }}
    >
      <View className="gap-8">
        <View className="flex-row">
          {(["red", "blue", "gold", "mint"] as const).map((c, i) => (
            <View key={c} style={{ marginLeft: i === 0 ? 0 : -10 }}>
              <ChipCoin size={52} color={c} />
            </View>
          ))}
        </View>
        <View className="gap-2">
          <T variant="display">{APP_NAME}</T>
          <T variant="body" className="text-soft">
            {DISCLAIMER}
          </T>
        </View>
        <View className="gap-5">
          <Point icon={Sparkles} title="13 casino games" body="Dice, Mines, Plinko, Crash, Blackjack and more." />
          <Point icon={ShieldCheck} title="Every result can be checked" body="Each round comes from seeds you can verify later." />
          <Point icon={CloudOff} title="Fully offline" body="No account, no internet, no purchases." />
        </View>
      </View>
      <Btn label={`Start with ${formatCoins(balance).replace(".00", "")} coins`} size="lg" onPress={() => updateSetting("acknowledged", true)} />
    </Animated.View>
  );
}
