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

/** iOS-style segmented control on HeroUI Tabs: soft track, raised selected segment. */
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
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Tabs.List className="w-full rounded-full bg-surface-2 p-1">
        <Tabs.Indicator className="rounded-full bg-page shadow-sm" />
        {options.map((o) => (
          <Tabs.Trigger key={String(o.value)} value={String(o.value)} isDisabled={disabled} className="h-9 flex-1 items-center justify-center px-1">
            {({ isSelected }) => (
              <Tabs.Label numberOfLines={1} className={`font-body-bold text-[13px] capitalize ${isSelected ? "text-ink" : "text-soft"}`}>
                {o.label}
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
