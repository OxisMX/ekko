import type { ComponentType } from 'react'
import { BellIcon, CardIcon, ChartIcon, MenuBookIcon, QrIcon, StoreIcon, TagIcon } from './Icons'

export type AdminGroup = 'Mi programa' | 'Mi negocio' | 'Reportes'
export type AdminSection = {
  path: string
  label: string
  group: AdminGroup
  Icon: ComponentType<{ className?: string }>
}

// Appflow §1.2 / brief §7.3 (P-05…P-11; P-08 lives inside Menú). P-17: ordered by group, the side nav renders a heading per group.
export const ADMIN_SECTIONS: AdminSection[] = [
  { path: 'tarjeta', label: 'Tarjeta', group: 'Mi programa', Icon: CardIcon },
  { path: 'menu', label: 'Menú', group: 'Mi programa', Icon: MenuBookIcon },
  { path: 'ofertas', label: 'Ofertas', group: 'Mi programa', Icon: TagIcon },
  { path: 'notificaciones', label: 'Notificaciones', group: 'Mi programa', Icon: BellIcon },
  { path: 'perfil', label: 'Perfil del negocio', group: 'Mi negocio', Icon: StoreIcon },
  { path: 'metricas', label: 'Métricas', group: 'Reportes', Icon: ChartIcon },
  { path: 'qr', label: 'Registro de QR', group: 'Reportes', Icon: QrIcon },
]

export const ADMIN_GROUPS: AdminGroup[] = ['Mi programa', 'Mi negocio', 'Reportes']
