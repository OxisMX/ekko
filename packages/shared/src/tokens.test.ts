import { describe, expect, it } from "vitest";
import { colors } from "./tokens";

// WCAG 2.x relative luminance and contrast ratio.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const white = "#FFFFFF";
const textPairs: [string, string, string][] = [
  ["textPrimary", colors.textPrimary, colors.surface],
  ["textPrimary", colors.textPrimary, colors.surfaceMuted],
  ["textPrimary", colors.textPrimary, colors.surfaceCard],
  ["textSecondary", colors.textSecondary, colors.surface],
  ["textSecondary", colors.textSecondary, colors.surfaceMuted],
  ["textSecondary", colors.textSecondary, colors.surfaceCard],
  ["white on primary", white, colors.primary],
  ["white on navy", white, colors.navy],
  ["success on surface", colors.success, colors.surface],
  ["error on surface", colors.error, colors.surface],
];

describe("contraste AA (4.5:1)", () => {
  it.each(textPairs)("%s (%s sobre %s)", (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
