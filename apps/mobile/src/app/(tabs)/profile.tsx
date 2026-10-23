import { TabSheet } from "../../components/layout/TabSheet";
import { ProfileScreen } from "../../features/profile/ProfileScreen";

export default function ProfileRoute() {
  return (
    <TabSheet>
      <ProfileScreen />
    </TabSheet>
  );
}
