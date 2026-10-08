import { Dialog } from "heroui-native";
import { View } from "react-native";

import { APP_NAME, DISCLAIMER } from "@/config/app";
import { useAppStore } from "@/store/appStore";
import { Btn } from "./Btn";
import { T } from "./Typography";

/** One-time play-money notice (store-safe positioning). */
export function FirstLaunchNotice() {
  const acknowledged = useAppStore((s) => s.settings.acknowledged);
  const updateSetting = useAppStore((s) => s.updateSetting);

  return (
    <Dialog isOpen={!acknowledged} onOpenChange={(open) => !open && updateSetting("acknowledged", true)}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="border border-white bg-black">
          <View className="gap-4">
            <T variant="label">Notice</T>
            <Dialog.Title className="text-3xl font-black tracking-tight text-white">{APP_NAME}</Dialog.Title>
            <View className="h-[3px] bg-white" />
            <Dialog.Description className="text-base text-white">{DISCLAIMER}</Dialog.Description>
            <T variant="small">Everything runs on this device. No account, no internet, no purchases.</T>
            <Btn label="I understand" onPress={() => updateSetting("acknowledged", true)} />
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
