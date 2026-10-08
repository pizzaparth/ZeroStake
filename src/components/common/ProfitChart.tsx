import { Canvas, DashPathEffect, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { formatSigned } from "@/engine/wallet/money";
import { T } from "./Typography";

/** Running profit line (Skia). White line on black; dashed zero line. */
export function ProfitChart({ series, height = 140 }: { series: number[]; height?: number }) {
  const [width, setWidth] = useState(0);

  const { path, zeroY } = useMemo(() => {
    const p = Skia.Path.Make();
    if (width === 0 || series.length === 0) return { path: p, zeroY: height / 2 };
    const values = [0, ...series];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const y = (v: number) => height - 8 - ((v - min) / span) * (height - 16);
    values.forEach((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * width;
      if (i === 0) p.moveTo(x, y(v));
      else p.lineTo(x, y(v));
    });
    return { path: p, zeroY: y(0) };
  }, [series, width, height]);

  const last = series.at(-1) ?? 0;

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <T variant="label">Net profit · last {series.length} bets</T>
        <T variant="mono" className="font-mono-bold">
          {formatSigned(last)}
        </T>
      </View>
      <View className="border border-white" style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 2)}>
        {width > 0 && (
          <Canvas style={{ width, height: height - 2 }} accessibilityLabel={`Profit chart, currently ${formatSigned(last)} coins`}>
            <Line p1={vec(0, zeroY)} p2={vec(width, zeroY)} color="#ffffff" strokeWidth={1}>
              <DashPathEffect intervals={[4, 4]} />
            </Line>
            <Path path={path} color="#ffffff" style="stroke" strokeWidth={2} strokeJoin="round" />
          </Canvas>
        )}
      </View>
    </View>
  );
}
