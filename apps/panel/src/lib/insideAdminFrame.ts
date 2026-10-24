import { createContext } from 'react'

// AdminLayout sets this around its Outlet so a lazy section only shows its own content skeleton (P-18).
export const InsideAdminFrame = createContext(false)
