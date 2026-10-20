import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import { CashierModePage } from './pages/CashierModePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'

const router = createBrowserRouter([
  { path: '/', element: <CashierModePage /> },
  { path: '/login', element: <LoginPage /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
