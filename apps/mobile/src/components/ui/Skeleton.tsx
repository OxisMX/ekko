import { useEffect } from "react";
import { Animated, View, type DimensionValue } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { useReduceMotion } from "../useReduceMotion";

// WHY: one loop drives every skeleton on screen, so they pulse in sync and cost one animation, not N.
const sharedOpacity = new Animated.Value(1);
const staticOpacity = new Animated.Value(1);
const pulse = Animated.loop(
  Animated.sequence([
    Animated.timing(sharedOpacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    Animated.timing(sharedOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
  ]),
);
let subscribers = 0;

function subscribePulse() {
  if (subscribers++ === 0) pulse.start();
  return () => {
    if (--subscribers === 0) {
      pulse.stop();
      sharedOpacity.setValue(1);
    }
  };
}

export type SkeletonProps = {
  width?: DimensionValue;
  height: DimensionValue;
  radius?: number;
  testID?: string;
};

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const;

// PX-5: shows the shape of the content while it loads, never a spinner.
export function Skeleton({ width = "100%", height, radius = radii.field, testID }: SkeletonProps) {
  // §9: no pulse when the system asks for reduced motion (null = not known yet, stays still).
  const reduceMotion = useReduceMotion();
  const animate = reduceMotion === false;
  useEffect(() => (animate ? subscribePulse() : undefined), [animate]);
  const opacity = animate ? sharedOpacity : staticOpacity;

  return (
    <Animated.View
      {...hidden}
      testID={testID}
      style={{ width, height, borderRadius: radius, borderCurve: "continuous", backgroundColor: colors.surfaceMuted, opacity }}
    />
  );
}

// Mirrors MerchantCard's layout: 16:9 cover, overlapping logo, name, category, two description lines.
export function MerchantCardSkeleton({ testID }: { testID?: string }) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel="Cargando"
      style={{ borderRadius: radii.card, borderCurve: "continuous", borderWidth: 1, borderColor: colors.surfaceMuted, overflow: "hidden" }}
    >
      <View {...hidden}>
        <View style={{ aspectRatio: 16 / 9 }}>
          <Skeleton height="100%" radius={0} />
        </View>
        <View style={{ position: "absolute", left: spacing.lg, bottom: -28 }}>
          <View style={{ borderWidth: 3, borderColor: colors.surface, borderRadius: 28 }}>
            <Skeleton width={50} height={50} radius={25} />
          </View>
        </View>
      </View>
      <View {...hidden} style={{ paddingTop: 28 + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
        <Skeleton width="60%" height={22} />
        <Skeleton width="35%" height={16} />
        <Skeleton height={14} />
        <Skeleton width="80%" height={14} />
      </View>
    </View>
  );
}
