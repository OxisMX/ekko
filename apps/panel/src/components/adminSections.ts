import type { ComponentType } from 'react'
import { BellIcon, CardIcon, ChartIcon, MenuBookIcon, QrIcon, StoreIcon, TagIcon } from './Icons'

export type AdminGroup = 'Mi programa' | 'Mi negocio' | 'Reportes'
export type AdminSection = {
  path: string
  label: string
  title: string
  purpose: string
  group: AdminGroup
  Icon: ComponentType<{ className?: string }>
}

// Appflow §1.2 / brief §7.3 (P-05…P-11; P-08 lives inside Menú). P-17: ordered by group, the side nav renders a heading per group.
export const ADMIN_SECTIONS: AdminSection[] = [
  { path: 'tarjeta', label: 'Tarjeta', title: 'Configuración de tarjeta', purpose: 'Sellos, premio, términos, vigencias e imagen de fondo de tu tarjeta.', group: 'Mi programa', Icon: CardIcon },
  { path: 'menu', label: 'Menú', title: 'Menú', purpose: 'Categorías y productos, con interruptores de “Agotado por hoy” y “Más pedidos”.', group: 'Mi programa', Icon: MenuBookIcon },
  { path: 'ofertas', label: 'Ofertas', title: 'Ofertas semanales', purpose: 'Las ofertas de cada día que tus clientes ven en la app.', group: 'Mi programa', Icon: TagIcon },
  { path: 'notificaciones', label: 'Notificaciones', title: 'Notificaciones push', purpose: 'Redacta un aviso con cupón opcional, revisa la vista previa y tus envíos restantes.', group: 'Mi programa', Icon: BellIcon },
  { path: 'perfil', label: 'Perfil del negocio', title: 'Perfil del negocio', purpose: 'Logo, portada, nombre, categoría, descripción y enlaces de tu negocio.', group: 'Mi negocio', Icon: StoreIcon },
  { path: 'metricas', label: 'Métricas', title: 'Métricas', purpose: 'Visitas, canjes y clientes activos de tu negocio.', group: 'Reportes', Icon: ChartIcon },
  { path: 'qr', label: 'Registro de QR', title: 'Registro de QR', purpose: 'Bitácora de los QR generados en caja y de los que tus clientes usaron.', group: 'Reportes', Icon: QrIcon },
]

export const ADMIN_GROUPS: AdminGroup[] = ['Mi programa', 'Mi negocio', 'Reportes']
