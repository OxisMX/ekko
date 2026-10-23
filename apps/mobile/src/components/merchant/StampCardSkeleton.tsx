import { View } from "react-native";
import { radii, spacing } from "../../theme";
import { Skeleton } from "../ui";

const ROWS = [4, 4];

// A-24: the shape of the stamp card (circle grid + two text lines) instead of a 260 pt block.
export function StampCardSkeleton() {
  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.stampContainer, borderCurve: "continuous", borderWidth: 1, borderColor: "transparent" }}>
      {ROWS.map((count, row) => (
        <View key={row} style={{ flexDirection: "row", justifyContent: "center", gap: spacing.sm }}>
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <Skeleton width={56} height={56} radius={28} />
            </View>
          ))}
        </View>
      ))}
      <Skeleton width="45%" height={22} />
      <Skeleton width="70%" height={16} />
    </View>
  );
}
