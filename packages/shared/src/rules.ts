// WHY: the DB is authoritative (TRD §4); these mirror its rules only for form validation and UI.
export const STAMPS = { min: 4, max: 10, default: 6 } as const;
export const CYCLE_MONTHS = { min: 3, max: 12, default: 6 } as const;
export const PUSH_COUPON_VALIDITY_OPTIONS = [48, 36, 24, 12, 6] as const;
export const PUSH_MONTHLY_LIMIT = 5;
export const QR_TTL_SECONDS = 60;
export const REDEMPTION_CODE_LENGTH = 6;
export const REDEMPTION_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const COUPON_VALIDITY = { wheelHours: 48, cardRewardDays: 30 } as const;
export const TIMEZONE = "America/Mexico_City";
export const MIN_AGE = 18;
export const PASSWORD_MIN_LENGTH = 10;
