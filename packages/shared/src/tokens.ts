// Design tokens from docs/ekko_brief_ux_ui.md §4.3-4.5 (ED-3).
export const colors = {
  bgBrand: "#1E2124",
  pattern: "#2C3A5E",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F1F1",
  surfaceCard: "#E9E6DF",
  textPrimary: "#1E2124",
  // WHY: brief value #6B6F76 gave 4.47:1 on surfaceMuted and 4.05:1 on surfaceCard (< AA 4.5:1).
  textSecondary: "#64676E",
  primary: "#1E2124",
  navy: "#1F2A4A",
  // NOTE: never used for text; 2.08:1 on surfaceCard (< 3:1 of WCAG 1.4.11), so it must not be the only carrier of information.
  accent: "#FF7A3D",
  // WHY: brief value #1F9D55 gave 3.49:1 on surface as text (< AA 4.5:1).
  success: "#1B8749",
  error: "#D93A3A",
  warning: "#E0A100",
  // WHY: favorite heart is not an error; a warm rose (#C2185B) is 5.9:1 on white and keeps the heart apart from colors.error.
  favorite: "#C2185B",
  // navy at 12%: subtle on white while navy content keeps full contrast on top (active tab pill).
  navyTint: "rgba(31, 42, 74, 0.12)",
  // Translucent white over merchant imagery (brief §6.2).
  veil: "rgba(255, 255, 255, 0.78)",
  // Modal backdrop (date picker sheet).
  overlay: "rgba(0, 0, 0, 0.4)",
  // Camera-only scrim, dark enough for white text over any preview.
  scrim: "rgba(0, 0, 0, 0.62)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;

export const radii = { pill: 999, field: 8, button: 12, card: 16, stampContainer: 24, sheet: 32 } as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: "700" },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase" },
  code: { fontSize: 32, lineHeight: 40, fontWeight: "700", fontVariant: ["tabular-nums"] },
  // The revealed coupon code shown to the cashier (A-67).
  codeLarge: { fontSize: 48, lineHeight: 56, fontWeight: "700", fontVariant: ["tabular-nums"] },
} as const;

// Durations in ms. Easing: strong ease-out bezier(0.23, 1, 0.32, 1) for entrances; springs only for "pop" moments.
export const motion = { fast: 120, base: 250, celebrate: 500 } as const;
