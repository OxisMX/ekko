import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

import { decelTarget, decelTickOffsets, WHEEL_DECEL_MS, WHEEL_PRIME_TURN_MS, winningRotation } from "../../features/wheel/wheelAngle";
import { light } from "../../lib/haptics";
import { colors, fontFamily } from "../../theme";

const REDUCED_MS = 300;
const MAX_LABEL = 14;

export type WheelDiscProps = {
  labels: string[];
  size: number;
  /** A-70: true from the tap until the server answers; the disc spins linearly meanwhile. */
  spinning?: boolean;
  /** Set once the server answered; the disc then decelerates until that segment is under the pointer. */
  targetIndex: number | null;
  reduceMotion: boolean;
  onSettled: () => void;
};

function polar(radius: number, degrees: number, center: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: center + radius * Math.cos(radians), y: center + radius * Math.sin(radians) };
}

// WHY: long labels are cut on the disc only; the full text is in the result and the accessibility label.
const shortLabel = (label: string) => (label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label);

// A-12 disc: alternating navy / warm-grey slices, pointer in accent (reward moment, OD-3).
export function WheelDisc({ labels, size, spinning = false, targetIndex, reduceMotion, onSettled }: WheelDiscProps) {
  const [rotation] = useState(() => new Animated.Value(0));
  const center = size / 2;
  const radius = center - 4;
  const slice = 360 / labels.length;

  // A-70: priming spin, so the tap is answered immediately. Reduce motion keeps the disc still until the result.
  const priming = spinning && targetIndex === null && !reduceMotion;
  useEffect(() => {
    if (!priming) return;
    const loop = Animated.loop(Animated.timing(rotation, { toValue: 360, duration: WHEEL_PRIME_TURN_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [priming, rotation]);

  useEffect(() => {
    if (targetIndex === null) return;
    let animation: Animated.CompositeAnimation | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    // stopAnimation hands back the angle reached by the priming spin, so the decel continues from it.
    rotation.stopAnimation((current) => {
      if (cancelled) return;
      const from = current % 360;
      rotation.setValue(from);
      animation = Animated.timing(rotation, {
        toValue: reduceMotion ? winningRotation(targetIndex, labels.length, 0) : decelTarget(from, targetIndex, labels.length),
        duration: reduceMotion ? REDUCED_MS : WHEEL_DECEL_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start(({ finished }) => finished && onSettled());
      if (!reduceMotion) decelTickOffsets().forEach((offset) => timers.push(setTimeout(light, offset)));
    });
    return () => {
      cancelled = true;
      animation?.stop();
      timers.forEach(clearTimeout);
    };
    // WHY: only a new target starts the decel; labels/motion are fixed for that spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIndex]);

  const spin = rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] });

  return (
    <View style={{ width: size, height: size + 20, alignItems: "center" }} accessible accessibilityLabel={`Ruleta con ${labels.length} premios: ${labels.join(", ")}`}>
      <Animated.View style={{ marginTop: 20, width: size, height: size, transform: [{ rotate: spin }] }}>
        <Svg width={size} height={size}>
          {labels.map((label, i) => {
            const start = polar(radius, i * slice, center);
            const end = polar(radius, (i + 1) * slice, center);
            const dark = i % 2 === 0;
            const mid = (i + 0.5) * slice;
            const textAt = polar(radius * 0.62, mid, center);
            return (
              <G key={i}>
                <Path
                  d={`M${center} ${center} L${start.x} ${start.y} A${radius} ${radius} 0 0 1 ${end.x} ${end.y} Z`}
                  fill={dark ? colors.navy : colors.surfaceCard}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
                <SvgText
                  x={textAt.x}
                  y={textAt.y}
                  fill={dark ? colors.surface : colors.textPrimary}
                  fontFamily={fontFamily.semibold}
                  fontSize={13}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  transform={`rotate(${mid - 90} ${textAt.x} ${textAt.y})`}
                >
                  {shortLabel(label)}
                </SvgText>
              </G>
            );
          })}
          {/* A-73: outer ring and a bigger navy hub frame the disc. */}
          <Circle cx={center} cy={center} r={radius} fill="none" stroke={colors.navy} strokeWidth={4} />
          <Circle cx={center} cy={center} r={size * 0.08} fill={colors.navy} stroke={colors.surface} strokeWidth={3} />
          <Circle cx={center} cy={center} r={size * 0.03} fill={colors.accent} />
        </Svg>
      </Animated.View>
      <Svg width={28} height={32} style={{ position: "absolute", top: 0 }}>
        <Path d="M2 2 H26 L14 30 Z" fill={colors.accent} stroke={colors.navy} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
