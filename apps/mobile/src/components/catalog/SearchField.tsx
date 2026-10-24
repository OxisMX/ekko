import { Pressable, TextInput, View } from "react-native";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { Close, Search } from "../icons";
import { fieldBoxStyle } from "../ui/TextField";

export type SearchFieldProps = { value: string; onChangeText: (text: string) => void; testID?: string };

// A-18: magnifier + our own 44 pt clear button, because the native clear only exists on iOS.
export function SearchField({ value, onChangeText, testID }: SearchFieldProps) {
  return (
    <View style={[fieldBoxStyle(false), { paddingLeft: spacing.lg }]}>
      <Search color={colors.textSecondary} size={20} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Busca un negocio"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Buscar negocios"
        returnKeyType="search"
        autoCorrect={false}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[textStyles.body, { flex: 1, minHeight: 48, paddingHorizontal: spacing.sm, color: colors.textPrimary }]}
        testID={testID}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          testID={testID && `${testID}-clear`}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Close color={colors.textSecondary} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}
