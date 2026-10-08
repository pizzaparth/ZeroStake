import { Canvas, Circle, DashPathEffect, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { C } from "@/config/theme";
import { formatSigned } from "@/engine/wallet/money";
import { T } from "./Typography";

/** Running profit line (Skia): gold line, flat fill to the zero line, dashed zero. */
export function ProfitChart({ series, height = 150 }: { series: number[]; height?: number }) {
  const [width, setWidth] = useState(0);

  const { line, area, zeroY, end } = useMemo(() => {
    const line = Skia.Path.Make();
    const area = Skia.Path.Make();
    if (width === 0 || series.length === 0) return { line, area, zeroY: height / 2, end: { x: 0, y: 0 } };
    const values = [0, ...series];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const y = (v: number) => height - 12 - ((v - min) / span) * (height - 24);
    const x = (i: number) => (i / Math.max(1, values.length - 1)) * width;
    values.forEach((v, i) => (i === 0 ? line.moveTo(x(i), y(v)) : line.lineTo(x(i), y(v))));
    area.addPath(line);
    area.lineTo(width, y(0));
    area.lineTo(0, y(0));
    area.close();
    return { line, area, zeroY: y(0), end: { x: x(values.length - 1), y: y(values.at(-1)!) } };
  }, [series, width, height]);

  const last = series.at(-1) ?? 0;

  return (
    <View className="gap-3 rounded-3xl bg-surface p-4">
      <View className="flex-row items-baseline justify-between">
        <T variant="heading">Profit over your last {series.length} bets</T>
        <T variant="num" className={`font-body-bold ${last >= 0 ? "text-pos" : "text-neg"}`}>
          {formatSigned(last)}
        </T>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Canvas style={{ width, height }} accessibilityLabel={`Profit chart, currently ${formatSigned(last)} coins`}>
            <Path path={area} color={C.surface2} />
            <Line p1={vec(0, zeroY)} p2={vec(width, zeroY)} color={C.soft} strokeWidth={1}>
              <DashPathEffect intervals={[4, 5]} />
            </Line>
            <Path path={line} color={C.ink} style="stroke" strokeWidth={3} strokeJoin="round" strokeCap="round" />
            <Circle cx={end.x} cy={end.y} r={5} color={C.ink} />
          </Canvas>
        )}
      </View>
    </View>
  );
}
