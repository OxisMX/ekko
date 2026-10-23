import { TabSheet } from "../../components/layout/TabSheet";
import { MyCardsScreen } from "../../features/cards/MyCardsScreen";

export default function CardsRoute() {
  return (
    <TabSheet>
      <MyCardsScreen />
    </TabSheet>
  );
}
