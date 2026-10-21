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
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;

export const radii = { field: 8, button: 12, card: 16, stampContainer: 24, sheet: 32 } as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: "700" },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase" },
  code: { fontSize: 32, lineHeight: 40, fontWeight: "700", fontVariant: ["tabular-nums"] },
} as const;
