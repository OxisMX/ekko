// testID scheme (RQ-3), used by Maestro (.maestro/) and jest:
//   screen/element  -> "<screen>-<element>"           e.g. "login-submit", "wheel-spin"
//   list items      -> "<entity>-<id>"                e.g. "my-card-<merchantId>", "my-coupon-<id>"
//   child controls  -> "<parent testID>-<suffix>"     e.g. "visit-result-primary", "cards-tabs-coupons"
//   tab bar         -> "tab-<route>"                  e.g. "tab-cards"
// kebab-case, English, stable: never derived from copy (labels are Spanish and may change).
export { Button, type ButtonProps } from "./Button";
export { Chip, type ChipProps } from "./Chip";
export { TextField, type TextFieldProps } from "./TextField";
export { DateField, type DateFieldProps } from "./DateField";
export { FormMessage, type FormMessageProps } from "./FormMessage";
export { PasswordField, type PasswordFieldProps } from "./PasswordField";
export { Skeleton, MerchantCardSkeleton, type SkeletonProps } from "./Skeleton";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { VerificationBanner, type VerificationBannerProps } from "./VerificationBanner";
export { CodeField, type CodeFieldProps } from "./CodeField";
export { SegmentedTabs, SEGMENTED_TABS_HEIGHT, type SegmentedTab, type SegmentedTabsProps } from "./SegmentedTabs";
export { Toast, TOAST_DURATION_MS, type ToastProps } from "./Toast";
