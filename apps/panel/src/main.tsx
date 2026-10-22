import '@fontsource-variable/dm-sans'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { AdminLayout, AdminPlaceholderPage } from './components/AdminLayout.tsx'
import { ADMIN_SECTIONS } from './components/adminSections.ts'
import { PanelGate } from './components/PanelGate.tsx'
import './index.css'
import { queryClient } from './lib/queryClient.ts'
import { initSentry } from './lib/sentry.ts'
import { CashierModePage } from './pages/CashierModePage.tsx'
import { InactivePage } from './pages/InactivePage.tsx'
import { CardConfigPage } from './pages/CardConfigPage.tsx'
import { MenuPage } from './pages/MenuPage.tsx'
import { ProductFormPage } from './pages/ProductFormPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'

initSentry()

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <PanelGate />,
    children: [
      { path: '/', element: <CashierModePage /> },
      { path: '/inactiva', element: <InactivePage /> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="metricas" replace /> },
          { path: 'tarjeta', element: <CardConfigPage /> },
          { path: 'menu', element: <MenuPage /> },
          { path: 'menu/nuevo', element: <ProductFormPage /> },
          { path: 'menu/:productId', element: <ProductFormPage /> },
          ...ADMIN_SECTIONS.filter((section) => !['tarjeta', 'menu'].includes(section.path)).map((section) => ({
            path: section.path,
            element: <AdminPlaceholderPage section={section} />,
          })),
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
