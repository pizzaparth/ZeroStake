import { Dialog, Switch, useToast } from "heroui-native";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Btn } from "@/components/common/Btn";
import { Segmented } from "@/components/common/Segmented";
import { T } from "@/components/common/Typography";
import { Screen, Section } from "@/components/layout/Screen";
import { APP_NAME, CURRENCY_NAME, DISCLAIMER, STARTING_BALANCE_OPTIONS } from "@/config/app";
import { clearHistory } from "@/engine/persistence/storage";
import { formatCoins, formatCoinsCompact } from "@/engine/wallet/money";
import { resetBalance } from "@/engine/wallet/transactions";
import { useAppStore } from "@/store/appStore";
import type { Settings } from "@/store/settings";
import { haptic, playSound } from "@/utils/feedback";

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

function Toggle({ k, label, description }: { k: BoolKey; label: string; description: string }) {
  const value = useAppStore((s) => s.settings[k]);
  const update = useAppStore((s) => s.updateSetting);
  const toggle = (v: boolean) => {
    update(k, v);
    haptic("select");
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={() => toggle(!value)}
      className="flex-row items-center gap-3 border-b border-white py-3"
    >
      <View className="flex-1">
        <T variant="body" className="font-bold">
          {label}
        </T>
        <T variant="small">{description}</T>
      </View>
      <Switch isSelected={value} onSelectedChange={toggle} className="border border-white" />
    </Pressable>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="border border-white bg-black">
          <View className="gap-4">
            <Dialog.Title className="text-2xl font-black text-white">{title}</Dialog.Title>
            <Dialog.Description className="text-sm text-white">{body}</Dialog.Description>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Btn label="Cancel" variant="outline" onPress={() => onOpenChange(false)} />
              </View>
              <View className="flex-1">
                <Btn
                  label={confirm}
                  onPress={() => {
                    onConfirm();
                    onOpenChange(false);
                  }}
                />
              </View>
            </View>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const update = useAppStore((s) => s.updateSetting);
  const refresh = useAppStore((s) => s.refresh);
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <Screen kicker="Local only" title="Settings">
      <Section title="Balance">
        <T variant="small">Reset amount</T>
        <Segmented
          accessibilityLabel="Reset amount"
          value={settings.startingBalance}
          options={STARTING_BALANCE_OPTIONS.map((v) => ({ value: v, label: formatCoinsCompact(v).replace(".00", "") }))}
          onChange={(v) => update("startingBalance", v)}
        />
        <Btn label={`Refill demo ${CURRENCY_NAME.toLowerCase()}`} onPress={() => setConfirmReset(true)} />
      </Section>

      <Section title="Feedback">
        <Toggle k="sound" label="Sound effects" description="Clicks, wins and losses. Follows the silent switch." />
        <Toggle k="haptics" label="Haptics" description="Vibration on taps, wins and losses." />
      </Section>

      <Section title="Display & accessibility">
        <Toggle k="animations" label="Animations" description="Turn off to reduce motion; results appear instantly." />
        <Toggle k="compactNumbers" label="Compact numbers" description="Show 12.3K instead of 12,345.67." />
      </Section>

      <Section title="Fairness">
        <Btn label="Client seed & rotation" variant="outline" onPress={() => router.navigate("/fairness")} />
        <Toggle k="showRngDetails" label="Show RNG details" description="Developer view: nonce, client seed and hash on game screens." />
      </Section>

      <Section title="Data">
        <Btn label="Clear bet history" variant="outline" onPress={() => setConfirmClear(true)} />
      </Section>

      <Section title="About">
        <T variant="small">{DISCLAIMER}</T>
        <T variant="monoSm">{APP_NAME} · v1.0.0 · 100% offline · SQLite on device</T>
      </Section>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset balance?"
        body={`Set your balance to ${formatCoins(settings.startingBalance)} ${CURRENCY_NAME}. Coins are fictional; history and seeds are kept.`}
        confirm="Reset"
        onConfirm={() => {
          resetBalance(settings.startingBalance);
          refresh();
          playSound("cashout");
          haptic("success");
          toast.show({ variant: "success", label: "Balance reset" });
        }}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear history?"
        body="Deletes settled bets and their ledger entries from this device. Balance, seeds and active rounds are kept. This cannot be undone."
        confirm="Clear"
        onConfirm={() => {
          clearHistory();
          refresh();
          toast.show({ variant: "success", label: "History cleared" });
        }}
      />
    </Screen>
  );
}
