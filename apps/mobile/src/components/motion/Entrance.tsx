import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Line } from "react-native-svg";
import { colors, motion } from "../../theme";
import { useReduceMotion } from "../useReduceMotion";

// expo-animation: strong ease-out for entrances.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export type EntranceProps = {
  children: ReactNode;
  /** Scale at the start of the entrance (1 = fade only). */
  from?: number;
  duration?: number;
  delay?: number;
  /** Springs instead of a timed ease-out; `duration` is ignored. */
  spring?: boolean;
  style?: StyleProp<ViewStyle>;
};

// §9: with reduce motion (or before the setting is known) children render in their final state.
export function Entrance({ children, from = 0.9, duration = motion.base, delay = 0, spring = false, style }: EntranceProps) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce === null) return;
    if (reduce) {
      progress.setValue(1);
      return;
    }
    const anim = spring
      ? Animated.spring(progress, { toValue: 1, delay, friction: 6, tension: 120, useNativeDriver: true })
      : Animated.timing(progress, { toValue: 1, duration, delay, easing: EASE_OUT, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, progress, spring, duration, delay]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [from, 1] });
  return <Animated.View style={[{ opacity: progress, transform: [{ scale }] }, style]}>{children}</Animated.View>;
}

const RAYS = 8;
const BURST_SIZE = 120;

// One-shot radial burst around a reward moment. Render it absolutely behind/over the target.
export function Burst({ size = BURST_SIZE, testID }: { size?: number; testID?: string }) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce !== false) return;
    const anim = Animated.timing(progress, { toValue: 1, duration: motion.celebrate, easing: EASE_OUT, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, progress]);
  // WHY: static decoration adds nothing under reduce motion, so it is not rendered at all.
  if (reduce !== false) return null;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.15] });
  const opacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] });
  const c = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", width: size, height: size, opacity, transform: [{ scale }] }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: RAYS }, (_, i) => {
          const a = (i * 2 * Math.PI) / RAYS;
          const [cos, sin] = [Math.cos(a), Math.sin(a)];
          return (
            <Line
              key={i}
              x1={c + cos * c * 0.7}
              y1={c + sin * c * 0.7}
              x2={c + cos * c * 0.95}
              y2={c + sin * c * 0.95}
              stroke={colors.accent}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

// Scale 1 → 1.2 → 1 (180 ms) each time `trigger` flips to true. Skipped under reduce motion.
export function Pop({ trigger, children, style }: { trigger: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const wasTriggered = useRef(trigger);
  useEffect(() => {
    const rising = trigger && !wasTriggered.current;
    wasTriggered.current = trigger;
    if (!rising || reduce) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [trigger, reduce, scale]);
  return <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>;
}
