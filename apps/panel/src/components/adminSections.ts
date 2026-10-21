import type { ComponentType } from 'react'
import { BellIcon, CardIcon, ChartIcon, MenuBookIcon, QrIcon, TagIcon } from './Icons'

export type AdminSection = { path: string; label: string; title: string; purpose: string; Icon: ComponentType<{ className?: string }> }

// Appflow §1.2 / brief §7.3 (P-05…P-11; P-08 lives inside Menú).
export const ADMIN_SECTIONS: AdminSection[] = [
  { path: 'metricas', label: 'Métricas', title: 'Métricas', purpose: 'Visitas, canjes y clientes activos de tu negocio.', Icon: ChartIcon },
  { path: 'tarjeta', label: 'Configuración de tarjeta', title: 'Configuración de tarjeta', purpose: 'Sellos, premio, términos, vigencias e imagen de fondo de tu tarjeta.', Icon: CardIcon },
  { path: 'menu', label: 'Menú', title: 'Menú', purpose: 'Categorías y productos, con interruptores de “Agotado por hoy” y “Más pedidos”.', Icon: MenuBookIcon },
  { path: 'ofertas', label: 'Ofertas', title: 'Ofertas semanales', purpose: 'Las ofertas de cada día que tus clientes ven en la app.', Icon: TagIcon },
  { path: 'notificaciones', label: 'Notificaciones', title: 'Notificaciones push', purpose: 'Redacta un aviso con cupón opcional, revisa la vista previa y tus envíos restantes.', Icon: BellIcon },
  { path: 'qr', label: 'Registro de QR', title: 'Registro de QR', purpose: 'Bitácora de los QR generados en caja y de los que tus clientes usaron.', Icon: QrIcon },
]
