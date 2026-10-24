import { View } from "react-native";
import { spacing } from "../../theme";
import { Skeleton } from "../ui";

// A-16: the shape of a form (label + field, repeated, then the button) while it loads.
export function FormSkeleton({ fields, label, testID }: { fields: number; label: string; testID?: string }) {
  return (
    <View accessible accessibilityLabel={label} testID={testID} style={{ gap: spacing.lg }}>
      {Array.from({ length: fields }, (_, i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <Skeleton width={96} height={14} />
          <Skeleton height={48} />
        </View>
      ))}
      <Skeleton height={48} radius={12} />
    </View>
  );
}
