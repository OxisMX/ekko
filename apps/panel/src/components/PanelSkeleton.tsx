import { useLocation } from 'react-router'

const block = 'rounded-field bg-black/[0.07] motion-safe:animate-pulse'

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-black/10 bg-surface px-6 py-3">
      <div className={`size-10 ${block}`} />
      <div className="flex-1 space-y-2">
        <div className={`h-3 w-20 ${block}`} />
        <div className={`h-5 w-56 ${block}`} />
      </div>
      <div className={`h-12 w-36 ${block}`} />
    </div>
  )
}

function CashierSkeleton() {
  return (
    <div className="grid flex-1 gap-6 p-6 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-card bg-surface p-6">
          <div className={`h-6 w-48 ${block}`} />
          <div className={`h-4 w-72 ${block}`} />
          <div className={`mx-auto my-6 size-[280px] max-w-full ${block}`} />
          <div className={`mt-auto h-14 w-full ${block}`} />
        </div>
      ))}
    </div>
  )
}

// Content area of an admin section: title plus two cards.
function SectionSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className={`h-8 w-56 ${block}`} />
      <div className="h-40 rounded-card bg-surface" />
      <div className="h-64 rounded-card bg-surface" />
    </div>
  )
}

function AdminFrameSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="hidden w-56 shrink-0 space-y-3 border-r border-black/10 bg-surface p-4 lg:block">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`h-12 w-full ${block}`} />
          ))}
        </div>
        <main className="flex-1 p-6">
          <SectionSkeleton />
        </main>
      </div>
    </>
  )
}

// Shared by PanelGate (session load) and the lazy route fallbacks in main.tsx (P-18): the shape matches
// where the user is going. variant="section" (inside AdminLayout) shows only the section content.
export function PanelSkeleton({ variant }: { variant?: 'section' }) {
  const { pathname } = useLocation()
  const admin = pathname === '/admin' || pathname.startsWith('/admin/')

  if (variant === 'section') return <SectionSkeleton />
  return (
    <div aria-busy="true" data-skeleton={admin ? 'admin' : 'cashier'} className="flex min-h-dvh flex-col">
      <span className="sr-only" role="status">
        Cargando tu negocio…
      </span>
      {admin ? (
        <AdminFrameSkeleton />
      ) : (
        <>
          <HeaderSkeleton />
          <CashierSkeleton />
        </>
      )}
    </div>
  )
}
