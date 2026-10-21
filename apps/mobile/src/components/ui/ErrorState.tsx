import { EmptyState } from "./EmptyState";

export type ErrorStateProps = {
  onRetry: () => void;
  title?: string;
  message?: string;
  actionLabel?: string;
  testID?: string;
};

// Defaults are E-01 "Sin conexión" (§8.2, RT-08).
export function ErrorState({
  onRetry,
  title = "Sin conexión",
  message = "No hay conexión. Revisa tus datos o Wi-Fi e inténtalo de nuevo.",
  actionLabel = "Reintentar",
  testID,
}: ErrorStateProps) {
  return <EmptyState title={title} message={message} actionLabel={actionLabel} onAction={onRetry} role="alert" testID={testID} />;
}
