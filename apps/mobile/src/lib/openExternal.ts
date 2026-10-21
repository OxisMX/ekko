import { ERRORS } from "@ekko/shared";
import * as Linking from "expo-linking";
import { Alert } from "react-native";

import { reportError } from "./sentry";

/**
 * SA-01 / SA-02. WHY the guard: maps_url and reviews_url are merchant data; only https links leave
 * the app (no tel:, intent:, javascript: or custom schemes).
 */
export function openExternalUrl(url: string | null | undefined, failMessage: string): void {
  if (!url || !/^https:\/\//i.test(url)) {
    reportError(new Error(`Refused non-https external url: ${url ?? "(empty)"}`));
    Alert.alert(ERRORS["E-99"].message, failMessage);
    return;
  }
  Linking.openURL(url).catch(reportError);
}
