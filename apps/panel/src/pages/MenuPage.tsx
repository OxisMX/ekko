import { merchantImageUrl } from '@ekko/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { AlertIcon, CheckCircleIcon, MenuBookIcon } from '../components/Icons'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { categoryNameSchema, formatPrice, MENU_LIMITS, MENU_QUERY_KEY, type MenuCategory, type MenuProduct, toMenu, useMenuFailure } from '../lib/menu'
import { supabase } from '../lib/supabase'

const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const outlineButton = `${buttonClass} border border-black/15 hover:bg-surface-muted`
const smallButton = 'min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40'
const inputClass = 'w-full rounded-xl border border-black/20 bg-surface px-4 py-3 text-base'

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-navy' : 'bg-black/30'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span aria-hidden="true">{label.split(':')[0]}</span>
    </label>
  )
}

function Thumbnail({ path }: { path: string | null }) {
  if (!path) return <div aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-muted text-text-secondary"><MenuBookIcon className="size-6" /></div>
  return <img src={merchantImageUrl(import.meta.env.VITE_SUPABASE_URL ?? '', path, 'product', 1)} alt="" className="size-16 shrink-0 rounded-xl bg-surface-muted object-cover" />
}

type Confirm = { kind: 'product' | 'category'; id: string; name: string; error?: string }

// P-07 (F-25).
export function MenuPage() {
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const failure = useMenuFailure()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  const menu = useQuery({
    queryKey: MENU_QUERY_KEY,
    queryFn: async () => toMenu(await adminRpc(() => supabase.rpc('list_menu_admin'))),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: MENU_QUERY_KEY })

  // Runs one admin action, reporting failures inline; `onError` lets a dialog keep its own message.
  async function run(action: () => Promise<unknown>, onError: (message: string) => void = setError) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
      return true
    } catch (err) {
      onError(failure(err).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function setFlags(product: MenuProduct, flags: Partial<Pick<MenuProduct, 'is_sold_out' | 'is_featured'>>) {
    const next = { ...product, ...flags }
    const previous = queryClient.getQueryData<MenuCategory[]>(MENU_QUERY_KEY)
    setError(null)
    queryClient.setQueryData<MenuCategory[]>(MENU_QUERY_KEY, (cats) =>
      cats?.map((c) => ({ ...c, products: c.products.map((p) => (p.id === product.id ? next : p)) })),
    )
    try {
      await adminRpc(() => supabase.rpc('set_product_flags', { p_id: product.id, p_sold_out_today: next.is_sold_out, p_is_featured: next.is_featured }))
    } catch (err) {
      queryClient.setQueryData(MENU_QUERY_KEY, previous)
      setError(failure(err).message)
    }
  }

  const saveCategory = (id: string | undefined, name: string, position?: number) =>
    adminRpc(() => supabase.rpc('upsert_menu_category', { p_id: id, p_name: name, p_position: position }))

  const saveProductPosition = (p: MenuProduct, position: number) =>
    adminRpc(() =>
      supabase.rpc('upsert_product', {
        p_id: p.id,
        p_category_id: p.category_id,
        p_name: p.name,
        p_description: p.description,
        p_price: p.price,
        // WHY: generated types omit `null`, but the RPC accepts it for "no image".
        p_image_path: p.image_path as string,
        p_position: position,
      }),
    )

  // Swapping positions of neighbours keeps it two writes with no drag-and-drop.
  const swap = <T extends { position: number }>(items: T[], index: number, direction: -1 | 1, write: (item: T, position: number) => Promise<unknown>) => {
    const a = items[index]
    const b = items[index + direction]
    return run(async () => {
      await write(a, b.position)
      await write(b, a.position)
    })
  }

  async function addCategory() {
    const parsed = categoryNameSchema.safeParse(newCategory)
    if (!parsed.success) return setNewCategoryError(parsed.error.issues[0].message)
    setNewCategoryError(null)
    if (await run(() => saveCategory(undefined, parsed.data), setNewCategoryError)) setNewCategory('')
  }

  async function renameCategory() {
    if (!renaming) return
    const parsed = categoryNameSchema.safeParse(renaming.name)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    if (await run(() => saveCategory(renaming.id, parsed.data))) setRenaming(null)
  }

  async function confirmDelete() {
    if (!confirm) return
    const { kind, id } = confirm
    const call = () =>
      adminRpc(() => (kind === 'product' ? supabase.rpc('delete_product', { p_id: id }) : supabase.rpc('delete_menu_category', { p_id: id })))
    if (await run(call, (message) => setConfirm({ ...confirm, error: message }))) setConfirm(null)
  }

  if (menu.isPending)
    return (
      <section aria-labelledby="menu-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 id="menu-title" className="text-2xl font-bold">Menú</h1>
        <div role="status" aria-label="Cargando el menú" className="flex animate-pulse flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-surface" />
          ))}
        </div>
      </section>
    )
  if (menu.isError)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">{failure(menu.error).message}</p>
        <button type="button" className={`${buttonClass} bg-navy text-white`} onClick={() => void menu.refetch()}>
          Reintentar
        </button>
      </div>
    )

  const categories = [...menu.data].sort((a, b) => a.position - b.position)

  return (
    <section aria-labelledby="menu-title" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="menu-title" className="text-2xl font-bold">Menú</h1>
        {categories.length > 0 ? (
          <Link to="nuevo" className={`${buttonClass} flex items-center bg-navy text-white hover:bg-brand`}>Nuevo producto</Link>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button type="button" disabled aria-describedby="new-product-hint" className={`${buttonClass} bg-navy text-white`}>Nuevo producto</button>
            <p id="new-product-hint" className="text-sm text-text-secondary">Crea una categoría primero.</p>
          </div>
        )}
      </div>

      {notice && (
        <p role="status" className="flex items-center gap-2 font-medium text-success">
          <CheckCircleIcon className="size-5 shrink-0" />
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-2 font-medium text-error">
          <AlertIcon className="size-5 shrink-0" />
          {error}
        </p>
      )}

      <form className="flex flex-col gap-1.5 rounded-2xl bg-surface p-4" onSubmit={(e) => { e.preventDefault(); void addCategory() }}>
        <label htmlFor="new-category" className="font-semibold">Nueva categoría</label>
        <div className="flex flex-wrap gap-3">
          <input id="new-category" className={`${inputClass} min-w-0 flex-1`} value={newCategory} maxLength={MENU_LIMITS.categoryName + 10} placeholder="Ej. Bebidas calientes" aria-invalid={!!newCategoryError} onChange={(e) => setNewCategory(e.target.value)} />
          <button type="submit" disabled={busy} className={`${buttonClass} bg-navy text-white hover:bg-brand`}>Agregar categoría</button>
        </div>
        {newCategoryError && <p role="alert" className="text-sm font-medium text-error">{newCategoryError}</p>}
      </form>

      {categories.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center">
          <MenuBookIcon className="size-12 text-navy" />
          <p className="mt-4 text-lg font-semibold">Aún no tienes un menú</p>
          <p className="mt-1 max-w-md text-text-secondary">Empieza creando tu primera categoría arriba; después podrás agregar productos con foto y precio.</p>
        </div>
      )}

      {categories.map((category, ci) => {
        const products = [...category.products].sort((a, b) => a.position - b.position)
        return (
          <section key={category.id} aria-label={`Categoría ${category.name}`} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {renaming?.id === category.id ? (
                <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); void renameCategory() }}>
                  <input aria-label="Nombre de la categoría" autoFocus className={inputClass} value={renaming.name} onChange={(e) => setRenaming({ id: category.id, name: e.target.value })} />
                  <button type="submit" disabled={busy} className={`${buttonClass} bg-navy text-white`}>Guardar</button>
                  <button type="button" className={outlineButton} onClick={() => setRenaming(null)}>Cancelar</button>
                </form>
              ) : (
                <>
                  <h2 className="text-lg font-semibold">{category.name}</h2>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={smallButton} disabled={busy || ci === 0} aria-label={`Subir categoría ${category.name}`} onClick={() => void swap(categories, ci, -1, (c, position) => saveCategory(c.id, c.name, position))}>↑</button>
                    <button type="button" className={smallButton} disabled={busy || ci === categories.length - 1} aria-label={`Bajar categoría ${category.name}`} onClick={() => void swap(categories, ci, 1, (c, position) => saveCategory(c.id, c.name, position))}>↓</button>
                    <button type="button" className={smallButton} aria-label={`Renombrar categoría ${category.name}`} onClick={() => setRenaming({ id: category.id, name: category.name })}>Renombrar</button>
                    <button type="button" className={`${smallButton} text-error`} aria-label={`Eliminar categoría ${category.name}`} onClick={() => setConfirm({ kind: 'category', id: category.id, name: category.name })}>Eliminar</button>
                  </div>
                </>
              )}
            </div>

            {products.length === 0 && <p className="text-text-secondary">Esta categoría aún no tiene productos.</p>}
            <ul className="flex flex-col divide-y divide-black/10">
              {products.map((product, pi) => (
                <li key={product.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Thumbnail path={product.image_path} />
                    <div className="min-w-0">
                      <p className="font-semibold">{product.name}</p>
                      <p className="font-mono text-sm">{formatPrice(product.price)}</p>
                      {product.description && <p className="truncate text-sm text-text-secondary">{product.description}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Switch label={`Agotado por hoy: ${product.name}`} checked={product.is_sold_out} onChange={(v) => void setFlags(product, { is_sold_out: v })} />
                    <Switch label={`Más pedidos: ${product.name}`} checked={product.is_featured} onChange={(v) => void setFlags(product, { is_featured: v })} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={smallButton} disabled={busy || pi === 0} aria-label={`Subir ${product.name}`} onClick={() => void swap(products, pi, -1, saveProductPosition)}>↑</button>
                    <button type="button" className={smallButton} disabled={busy || pi === products.length - 1} aria-label={`Bajar ${product.name}`} onClick={() => void swap(products, pi, 1, saveProductPosition)}>↓</button>
                    <Link to={product.id} className={`${smallButton} flex items-center`} aria-label={`Editar ${product.name}`}>Editar</Link>
                    <button type="button" className={`${smallButton} text-error`} aria-label={`Eliminar ${product.name}`} onClick={() => setConfirm({ kind: 'product', id: product.id, name: product.name })}>Eliminar</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {confirm && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="flex w-full max-w-md flex-col gap-4 rounded-3xl bg-surface p-6">
            <h2 id="delete-title" className="text-xl font-semibold">{confirm.kind === 'product' ? '¿Eliminar este producto?' : '¿Eliminar esta categoría?'}</h2>
            <p>
              <strong>{confirm.name}</strong> se eliminará del menú que ven tus clientes. Esta acción no se puede deshacer.
            </p>
            {confirm.error && (
              <p role="alert" className="flex items-center gap-2 font-medium text-error">
                <AlertIcon className="size-5 shrink-0" />
                {confirm.error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" disabled={busy} className={outlineButton} onClick={() => setConfirm(null)}>Cancelar</button>
              <button type="button" disabled={busy} className={`${buttonClass} bg-navy text-white hover:bg-brand`} onClick={() => void confirmDelete()}>{busy ? 'Eliminando…' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
