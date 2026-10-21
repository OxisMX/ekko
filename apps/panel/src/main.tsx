import '@fontsource-variable/dm-sans'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { PanelGate } from './components/PanelGate.tsx'
import './index.css'
import { queryClient } from './lib/queryClient.ts'
import { initSentry } from './lib/sentry.ts'
import { CashierModePage } from './pages/CashierModePage.tsx'
import { InactivePage } from './pages/InactivePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'

initSentry()

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <PanelGate />,
    children: [
      { path: '/', element: <CashierModePage /> },
      { path: '/inactiva', element: <InactivePage /> },
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
