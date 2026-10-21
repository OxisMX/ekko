import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { Button } from "./Button";
import { FieldError, FieldLabel, fieldBoxStyle } from "./TextField";

// WHY: a birth date is a calendar date, not an instant. Keep the local Y/M/D the user picked
// and drop the time so no timezone conversion can move it to the previous/next day.
export function toCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatCalendarDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export type DateFieldProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
};

export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  error,
  placeholder = "Selecciona tu fecha",
  disabled = false,
  testID,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  // iOS: the inline picker edits a draft that is committed with "Listo".
  const [draft, setDraft] = useState<Date>(value ?? maximumDate ?? new Date());
  const insets = useSafeAreaInsets();
  const shown = value ? formatCalendarDate(value) : null;

  function openPicker() {
    setDraft(value ?? maximumDate ?? new Date());
    setOpen(true);
  }

  function handleAndroidChange(event: DateTimePickerEvent, date?: Date) {
    setOpen(false);
    if (event.type === "set" && date) onChange(toCalendarDate(date));
  }

  function confirmIos() {
    setOpen(false);
    onChange(toCalendarDate(draft));
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown ?? placeholder}`}
        accessibilityHint={error}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          fieldBoxStyle(!!error),
          { paddingHorizontal: spacing.lg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        ]}
      >
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[textStyles.body, { color: shown ? colors.textPrimary : colors.textSecondary, fontVariant: ["tabular-nums"] }]}
        >
          {shown ?? placeholder}
        </Text>
      </Pressable>
      <FieldError error={error} />

      {open && process.env.EXPO_OS === "android" ? (
        // Android renders this as a native dialog and unmounts on close.
        <DateTimePicker mode="date" value={draft} maximumDate={maximumDate} onChange={handleAndroidChange} />
      ) : null}

      {process.env.EXPO_OS !== "android" ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.4)" }}
            onPress={() => setOpen(false)}
            accessibilityLabel="Cerrar selector de fecha"
            accessibilityRole="button"
          />
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.card,
              borderTopRightRadius: radii.card,
              borderCurve: "continuous",
              padding: spacing.lg,
              paddingBottom: spacing.lg + insets.bottom,
              gap: spacing.md,
            }}
          >
            <DateTimePicker
              mode="date"
              display="inline"
              locale="es-MX"
              value={draft}
              maximumDate={maximumDate}
              onChange={(_event, date) => date && setDraft(date)}
              themeVariant="light"
            />
            <Button title="Listo" onPress={confirmIos} fullWidth />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
