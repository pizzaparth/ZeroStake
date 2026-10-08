import Svg, { Circle, Rect } from "react-native-svg";

import { CHIPS, type ChipColor } from "@/config/theme";

/** Flat casino chip: solid disc, six edge inserts, inner ring. */
export function ChipCoin({ size = 24, color = "gold" }: { size?: number; color?: ChipColor }) {
  const chip = CHIPS[color];
  const r = size / 2;
  const insert = size * 0.16;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={r} cy={r} r={r} fill={chip.fill} />
      {Array.from({ length: 6 }, (_, i) => (
        <Rect key={i} x={r - insert / 2} y={0} width={insert} height={size * 0.18} fill="#ffffff" transform={`rotate(${i * 60} ${r} ${r})`} />
      ))}
      <Circle cx={r} cy={r} r={r * 0.56} fill="#000000" opacity={0.14} />
      <Circle cx={r} cy={r} r={r * 0.46} fill={chip.fill} />
    </Svg>
  );
}
