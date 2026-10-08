import { Tabs } from "heroui-native";

import { haptic } from "@/utils/feedback";

export interface SegmentOption<V extends string | number> {
  value: V;
  label: string;
}

export interface SegmentedProps<V extends string | number> {
  value: V;
  options: SegmentOption<V>[];
  onChange: (value: V) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * Segmented control built on HeroUI Tabs: the animated indicator is a solid
 * white block, the selected label inverts to black.
 */
export function Segmented<V extends string | number>({ value, options, onChange, disabled, accessibilityLabel }: SegmentedProps<V>) {
  return (
    <Tabs
      value={String(value)}
      onValueChange={(v) => {
        const next = options.find((o) => String(o.value) === v);
        if (next && next.value !== value) {
          haptic("select");
          onChange(next.value);
        }
      }}
      accessibilityLabel={accessibilityLabel}
    >
      <Tabs.List className="w-full border border-white bg-black p-0.5">
        <Tabs.Indicator className="bg-white" />
        {options.map((o) => (
          <Tabs.Trigger key={String(o.value)} value={String(o.value)} isDisabled={disabled} className="flex-1 py-2">
            {({ isSelected }) => (
              <Tabs.Label className={`text-xs font-bold uppercase tracking-[1.5px] ${isSelected ? "text-black" : "text-white"}`}>
                {o.label}
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
