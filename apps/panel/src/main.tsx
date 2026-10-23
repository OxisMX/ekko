import '@fontsource-variable/dm-sans'
import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { PanelGate } from './components/PanelGate.tsx'
import { PanelSkeleton } from './components/PanelSkeleton.tsx'
import './index.css'
import { queryClient } from './lib/queryClient.ts'
import { initSentry } from './lib/sentry.ts'
import { CashierModePage } from './pages/CashierModePage.tsx'
import { InactivePage } from './pages/InactivePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'

initSentry()

// WHY: NF-05 — login and Modo Caja must not download admin-only code (forms, image processing).
function lazyRoute(load: () => Promise<Record<string, unknown>>, name: string) {
  const Page = lazy(async () => ({ default: (await load())[name] as ComponentType }))
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Page />
    </Suspense>
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <PanelGate />,
    children: [
      { path: '/', element: <CashierModePage /> },
      { path: '/inactiva', element: <InactivePage /> },
      {
        path: '/admin',
        element: lazyRoute(() => import('./components/AdminLayout.tsx'), 'AdminLayout'),
        children: [
          { index: true, element: <Navigate to="metricas" replace /> },
          { path: 'tarjeta', element: lazyRoute(() => import('./pages/CardConfigPage.tsx'), 'CardConfigPage') },
          { path: 'menu', element: lazyRoute(() => import('./pages/MenuPage.tsx'), 'MenuPage') },
          { path: 'menu/nuevo', element: lazyRoute(() => import('./pages/ProductFormPage.tsx'), 'ProductFormPage') },
          { path: 'menu/:productId', element: lazyRoute(() => import('./pages/ProductFormPage.tsx'), 'ProductFormPage') },
          { path: 'ofertas', element: lazyRoute(() => import('./pages/OffersPage.tsx'), 'OffersPage') },
          { path: 'ofertas/nueva', element: lazyRoute(() => import('./pages/OfferFormPage.tsx'), 'OfferFormPage') },
          { path: 'ofertas/:offerId', element: lazyRoute(() => import('./pages/OfferFormPage.tsx'), 'OfferFormPage') },
          { path: 'notificaciones', element: lazyRoute(() => import('./pages/PushPage.tsx'), 'PushPage') },
          { path: 'metricas', element: lazyRoute(() => import('./pages/MetricsPage.tsx'), 'MetricsPage') },
          { path: 'qr', element: lazyRoute(() => import('./pages/QrLogPage.tsx'), 'QrLogPage') },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
