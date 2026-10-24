import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthProvider";
import { useMyProfile } from "../../features/auth/account";
import { useMyCards } from "../../features/cards/myCards";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { BrandPattern } from "../auth/BrandPattern";

const EXPLORE_TITLE = "Explorar";

export function rewardsReadyText(count: number): string | undefined {
  if (count === 0) return undefined;
  return count === 1 ? "Tienes 1 recompensa lista" : `Tienes ${count} recompensas listas`;
}

// Same brand look as the login header: dark background with the navy circles behind the title.
export function AppHeader({ title }: { title: string }) {
  return title === EXPLORE_TITLE ? <ExploreHeader title={title} /> : <HeaderFrame title={title} />;
}

// A-09: Explorar greets by name and says how many rewards are waiting (both already cached).
// WHY: the tab layout only passes a title, so the header recognises Explorar by it.
function ExploreHeader({ title }: { title: string }) {
  const { status } = useAuth();
  const firstName = useMyProfile().data?.first_name;
  return status === "signedIn" ? (
    <ExploreGreeting title={title} firstName={firstName} />
  ) : (
    <HeaderFrame title={title} />
  );
}

function ExploreGreeting({ title, firstName }: { title: string; firstName?: string | null }) {
  const readyCount = useMyCards().data?.filter((card) => card.reward_available).length ?? 0;
  return <HeaderFrame title={firstName ? `Hola, ${firstName}` : title} subtitle={rewardsReadyText(readyCount)} />;
}

function HeaderFrame({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="app-header"
      style={{ backgroundColor: colors.bgBrand, overflow: "hidden", paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl, paddingHorizontal: spacing.xl }}
    >
      <BrandPattern />
      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[textStyles.h1, { color: colors.surface }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.accent, marginTop: spacing.xs }]} testID="app-header-rewards">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
