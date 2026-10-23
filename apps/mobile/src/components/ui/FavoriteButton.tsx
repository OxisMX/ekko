import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../theme";
import { Pop } from "../motion";

const SIZE = 44; // RT-04

export type FavoriteButtonProps = {
  isFavorite: boolean;
  onToggle: () => void;
  /** Circle background; the card sits it over a cover, the header over the page. */
  backgroundColor?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// WHY: filled vs outline heart (not only colour) tells the state apart (§9).
export function FavoriteButton({ isFavorite, onToggle, backgroundColor = colors.surface, testID, style }: FavoriteButtonProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
      accessibilityState={{ selected: isFavorite }}
      hitSlop={4}
      testID={testID}
      style={({ pressed }) => [
        { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Pop trigger={isFavorite}>
      <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
        <Path
          d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.8 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11z"
          stroke={isFavorite ? colors.favorite : colors.navy}
          strokeWidth={1.8}
          strokeLinejoin="round"
          fill={isFavorite ? colors.favorite : "none"}
        />
      </Svg>
      </Pop>
    </Pressable>
  );
}
