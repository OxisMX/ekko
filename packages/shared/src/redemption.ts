import { REDEMPTION_CODE_ALPHABET, REDEMPTION_CODE_LENGTH } from "./rules";

export function normalizeRedemptionCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidRedemptionCode(code: string): boolean {
  return (
    code.length === REDEMPTION_CODE_LENGTH &&
    [...code].every((char) => REDEMPTION_CODE_ALPHABET.includes(char))
  );
}
