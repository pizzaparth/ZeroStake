import { Dialog, Switch, useToast } from "heroui-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Btn } from "@/components/common/Btn";
import { ChipCoin } from "@/components/common/ChipCoin";
import { Segmented } from "@/components/common/Segmented";
import { PressableScale } from "@/components/common/PressableScale";
import { T } from "@/components/common/Typography";
import { Panel, Screen, Section } from "@/components/layout/Screen";
import { APP_NAME, CURRENCY_NAME, DISCLAIMER, STARTING_BALANCE_OPTIONS } from "@/config/app";
import { C, type ChipColor } from "@/config/theme";
import { clearHistory } from "@/engine/persistence/storage";
import { centsToCoins, formatCoins } from "@/engine/wallet/money";

import { resetBalance } from "@/engine/wallet/transactions";
import { useAppStore } from "@/store/appStore";
import type { Settings } from "@/store/settings";
import { haptic, playSound } from "@/utils/feedback";

/** 1K, 10K, 100K, 1M — for the refill picker. */
const shortAmount = (cents: number) => {
  const c = centsToCoins(cents);
  return c >= 1e6 ? `${c / 1e6}M` : c >= 1e3 ? `${c / 1e3}K` : String(c);
};

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

function Toggle({ k, label, description, last }: { k: BoolKey; label: string; description: string; last?: boolean }) {
  const value = useAppStore((s) => s.settings[k]);
  const update = useAppStore((s) => s.updateSetting);
  const toggle = (v: boolean) => {
    update(k, v);
    haptic("select");
  };
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={() => toggle(!value)}
      className={`flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-line"}`}
    >
      <View className="flex-1">
        <T variant="body" className="font-body-bold">
          {label}
        </T>
        <T variant="small">{description}</T>
      </View>
      <Switch isSelected={value} onSelectedChange={toggle} />
    </PressableScale>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  tone = "gold",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  body: string;
  confirm: string;
  tone?: ChipColor;
  onConfirm: () => void;
}) {
  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="rounded-3xl bg-page p-5">
          <View className="gap-4">
            <Dialog.Title className="font-display text-2xl text-ink">{title}</Dialog.Title>
            <Dialog.Description className="font-body text-base leading-6 text-soft">{body}</Dialog.Description>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Btn label="Cancel" variant="outline" onPress={() => onOpenChange(false)} />
              </View>
              <View className="flex-1">
                <Btn
                  label={confirm}
                  tone={tone}
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
  const balance = useAppStore((s) => s.balance);
  const update = useAppStore((s) => s.updateSetting);
  const refresh = useAppStore((s) => s.refresh);
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <Screen title="Settings" subtitle="Saved on this phone only.">
      <Panel className="gap-4">
        <View className="flex-row items-center gap-3">
          <ChipCoin size={44} />
          <View className="flex-1">
            <T variant="label">Balance</T>
            <T variant="numLg">{formatCoins(balance)}</T>
          </View>
        </View>
        <View className="gap-2">
          <T variant="label">Refill to</T>
          <Segmented
            accessibilityLabel="Refill amount"
            value={settings.startingBalance}
            options={STARTING_BALANCE_OPTIONS.map((v) => ({ value: v, label: shortAmount(v) }))}
            onChange={(v) => update("startingBalance", v)}
          />
        </View>
        <Btn
          label={`Refill to ${formatCoins(settings.startingBalance).replace(".00", "")} ${CURRENCY_NAME.toLowerCase()}`}
          onPress={() => setConfirmReset(true)}
        />
      </Panel>

      <Section title="Feel">
        <Panel className="py-1">
          <Toggle k="sound" label="Sound effects" description="Clicks, wins and losses. Respects the silent switch." />
          <Toggle k="haptics" label="Vibration" description="A tap on presses, wins and losses." />
          <Toggle k="animations" label="Animations" description="Turn off to reduce motion. Results show instantly." />
          <Toggle k="compactNumbers" label="Short numbers" description="Show 12.3K instead of 12,345.67." last />
        </Panel>
      </Section>

      <Section title="Fairness">
        <Panel className="py-1">
          <PressableScale
            accessibilityRole="link"
            onPress={() => requestAnimationFrame(() => router.navigate("/fairness"))}
            className="flex-row items-center gap-3 border-b border-line py-3"
          >
            <View className="flex-1">
              <T variant="body" className="font-body-bold">
                Client seed and rotation
              </T>
              <T variant="small">Change your seed or reveal the server seed.</T>
            </View>
            <ChevronRight size={20} color={C.soft} />
          </PressableScale>
          <Toggle k="showRngDetails" label="Show seed details in games" description="Nonce, client seed and hash under each board." last />
        </Panel>
      </Section>

      <Section title="Data">
        <Btn label="Clear bet history" variant="outline" onPress={() => setConfirmClear(true)} />
      </Section>

      <View className="gap-2">
        <T variant="small">{DISCLAIMER}</T>
        <T variant="small">{APP_NAME} 1.0. Works fully offline.</T>
      </View>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Refill your balance?"
        body={`Your balance becomes ${formatCoins(settings.startingBalance)} ${CURRENCY_NAME}. History and seeds stay as they are.`}
        confirm="Refill"
        onConfirm={() => {
          resetBalance(settings.startingBalance);
          refresh();
          playSound("cashout");
          haptic("success");
          toast.show({ variant: "success", label: "Balance refilled" });
        }}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear bet history?"
        body="This deletes finished bets and their ledger entries from this phone. Your balance, seeds and unfinished rounds stay. It can't be undone."
        confirm="Clear history"
        tone="red"
        onConfirm={() => {
          clearHistory();
          refresh();
          toast.show({ variant: "success", label: "History cleared" });
        }}
      />
    </Screen>
  );
}
