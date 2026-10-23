// Shared by PanelGate (session load) and the lazy route fallbacks in main.tsx.
export function PanelSkeleton() {
  const block = 'rounded-lg bg-black/[0.07] motion-safe:animate-pulse'
  return (
    <div aria-busy="true" className="flex min-h-dvh flex-col">
      <span className="sr-only" role="status">
        Cargando tu negocio…
      </span>
      <div className="flex items-center gap-4 border-b border-black/10 bg-surface px-6 py-3">
        <div className={`size-12 ${block}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-3 w-20 ${block}`} />
          <div className={`h-5 w-56 ${block}`} />
        </div>
        <div className={`h-12 w-36 ${block}`} />
      </div>
      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl bg-surface p-6">
            <div className={`h-6 w-48 ${block}`} />
            <div className={`h-4 w-72 ${block}`} />
            <div className={`mx-auto my-6 size-[280px] max-w-full ${block}`} />
            <div className={`mt-auto h-14 w-full ${block}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
