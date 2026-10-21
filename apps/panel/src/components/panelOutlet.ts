import { useOutletContext } from 'react-router'
import type { MerchantSession } from '../lib/panelRoute'

export type PanelOutletContext = { merchantSession: MerchantSession }

export const useMerchantSession = () => useOutletContext<PanelOutletContext>().merchantSession
