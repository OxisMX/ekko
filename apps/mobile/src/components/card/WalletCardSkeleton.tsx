import { View } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { Skeleton } from "../ui";
import { StampCardSkeleton } from "../merchant/StampCardSkeleton";
import { StampCardHeaderStrip, type StampCardHeader, STAMP_CARD_HEADER_HEIGHT } from "./StampCard";

type Props = {
  /** Known merchant data keeps the strip real while the card body loads. */
  header?: { header: StampCardHeader; progress: string; dimmed: boolean };
};

// Stand-in for a wallet card: header strip plus the shape of the stamp grid.
export function WalletCardSkeleton({ header }: Props) {
  return (
    <View style={{ borderRadius: radii.stampContainer, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.surfaceMuted }}>
      {header ? (
        <StampCardHeaderStrip {...header} />
      ) : (
        <View style={{ height: STAMP_CARD_HEADER_HEIGHT, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg }}>
          <Skeleton width={40} height={40} radius={20} />
          <Skeleton width="45%" height={20} />
        </View>
      )}
      <StampCardSkeleton />
    </View>
  );
}
