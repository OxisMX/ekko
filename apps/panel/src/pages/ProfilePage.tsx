import { ERRORS, merchantCategoryLabel, MERCHANT_CATEGORIES, merchantImageUrl } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Field } from '../components/FormField'
import { AlertIcon, CheckCircleIcon } from '../components/Icons'
import { ImagePicker } from '../components/ImagePicker'
import { useMerchantSession } from '../components/panelOutlet'
import { useAdminRpc } from '../lib/adminUnlockContext'
import { describeError } from '../lib/cardConfig'
import { PROFILE_KEY, PROFILE_LIMITS, type ProfileField, type ProfileForm, profileErrors, profileFormSchema, toProfileForm } from '../lib/merchantProfile'
import { supabase } from '../lib/supabase'
import { useMerchantImageUpload } from '../lib/useMerchantImageUpload'

const inputClass = 'w-full rounded-xl border border-black/20 bg-surface px-4 py-3 text-base'
const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'

// Edit-only: accounts are created by Oxis, so there is no create/delete flow here.
export function ProfilePage() {
  const { merchant } = useMerchantSession()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const ids = { name: useId(), category: useId(), description: useId(), maps: useId(), reviews: useId() }
  const logoUpload = useMerchantImageUpload('logo', 'brand')
  const coverUpload = useMerchantImageUpload('cover', 'brand')

  // Edits live apart from the loaded profile so a refetch or an E-16 detour never loses them.
  const [draft, setDraft] = useState<Partial<ProfileForm>>({})
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const profile = useQuery({
    queryKey: [...PROFILE_KEY, merchant.id],
    queryFn: async () => toProfileForm(await adminRpc(() => supabase.rpc('get_merchant_profile'))),
  })

  const save = useMutation({
    mutationFn: async (form: ProfileForm) => {
      const p = profileFormSchema.parse(form)
      return toProfileForm(
        await adminRpc(() =>
          supabase.rpc('update_merchant_profile', {
            p_name: p.name,
            p_category: p.category,
            p_description: p.description,
            p_maps_url: p.maps_url,
            p_reviews_url: p.reviews_url,
            p_logo_path: p.logo_path,
            p_cover_path: p.cover_path,
          }),
        ),
      )
    },
    onSuccess: (next) => {
      queryClient.setQueryData([...PROFILE_KEY, merchant.id], next)
      // WHY: the admin header and the cashier screen read name/logo from the merchant session.
      void queryClient.invalidateQueries({ queryKey: ['merchant-session'] })
      setDraft({})
      logoUpload.reset()
      coverUpload.reset()
      setSaveError(null)
      setSaved(true)
    },
    onError: (err) => {
      const { code } = describeError(err)
      if (code === 'E-99') Sentry.captureException(err)
      if (code === 'E-05') void queryClient.invalidateQueries({ queryKey: ['merchant-session'] })
      if (code === 'E-18' || code === 'E-19') void signOut(code)
      setSaveError(ERRORS[code].message)
    },
  })

  if (profile.isPending)
    return (
      <p role="status" className="p-6 text-text-secondary">
        Cargando el perfil de tu negocio…
      </p>
    )
  if (profile.isError)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-surface p-6">
        <p className="font-semibold">{ERRORS[describeError(profile.error).code].message}</p>
        <button type="button" className={`${buttonClass} bg-navy text-white`} onClick={() => void profile.refetch()}>
          Reintentar
        </button>
      </div>
    )

  const form: ProfileForm = { ...profile.data, ...draft }
  const errors = profileErrors(form)
  const dirty = Object.keys(draft).length > 0
  const uploading = logoUpload.uploading || coverUpload.uploading
  const canSave = dirty && Object.keys(errors).length === 0 && !uploading && !save.isPending

  const edit = <K extends ProfileField>(field: K, value: ProfileForm[K]) => {
    setSaved(false)
    setSaveError(null)
    setDraft((prev) => {
      if (value !== profile.data[field]) return { ...prev, [field]: value }
      const { [field]: _unchanged, ...rest } = prev
      return rest
    })
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  const logoUrl = logoUpload.preview ?? (form.logo_path ? merchantImageUrl(supabaseUrl, form.logo_path, 'logo', 2) : null)
  const coverUrl = coverUpload.preview ?? (form.cover_path ? merchantImageUrl(supabaseUrl, form.cover_path, 'cover', 1) : null)

  async function pickLogo(file: File | undefined) {
    const path = await logoUpload.pick(file)
    if (path) edit('logo_path', path)
  }
  async function pickCover(file: File | undefined) {
    const path = await coverUpload.pick(file)
    if (path) edit('cover_path', path)
  }

  const bind = (field: ProfileField, id: string) => ({
    id,
    className: inputClass,
    value: form[field],
    'aria-invalid': !!errors[field],
    'aria-describedby': `${id}-error`,
  })

  return (
    <section aria-labelledby="profile-title" className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 id="profile-title" className="text-2xl font-bold">
        Perfil del negocio
      </h1>

      <form
        className="flex flex-col gap-6 rounded-2xl bg-surface p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) save.mutate(form)
        }}
      >
        <div className="grid gap-6 md:grid-cols-[10rem_1fr]">
          <div className="flex flex-col gap-3">
            <p className="font-semibold">Logo</p>
            {logoUrl ? <img src={logoUrl} alt="Logo del negocio" className="size-32 rounded-2xl bg-surface-muted object-cover" /> : <div className="size-32 rounded-2xl bg-surface-muted" />}
            <ImagePicker inputLabel="Elegir logo" hasImage={!!form.logo_path} uploading={logoUpload.uploading} error={logoUpload.error ?? errors.logo_path ?? null} onPick={(f) => void pickLogo(f)} />
          </div>
          <div className="flex flex-col gap-3">
            <p className="font-semibold">Portada</p>
            {coverUrl ? <img src={coverUrl} alt="Portada del negocio" className="aspect-video w-full max-w-md rounded-2xl bg-surface-muted object-cover" /> : <div className="aspect-video w-full max-w-md rounded-2xl bg-surface-muted" />}
            <ImagePicker inputLabel="Elegir portada" hasImage={!!form.cover_path} uploading={coverUpload.uploading} error={coverUpload.error ?? errors.cover_path ?? null} onPick={(f) => void pickCover(f)} />
          </div>
        </div>

        <Field id={ids.name} label="Nombre comercial" error={errors.name} counter={`${form.name.length}/${PROFILE_LIMITS.name}`}>
          <input {...bind('name', ids.name)} onChange={(e) => edit('name', e.target.value)} />
        </Field>
        <Field id={ids.category} label="Categoría" error={errors.category}>
          <select {...bind('category', ids.category)} onChange={(e) => edit('category', e.target.value as ProfileForm['category'])}>
            {MERCHANT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {merchantCategoryLabel[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={ids.description} label="Descripción breve" error={errors.description} counter={`${form.description.length}/${PROFILE_LIMITS.description}`}>
          <textarea rows={3} {...bind('description', ids.description)} onChange={(e) => edit('description', e.target.value)} />
        </Field>
        <Field id={ids.maps} label="Enlace a Google Maps" error={errors.maps_url}>
          <input type="url" inputMode="url" placeholder="https://maps.google.com/…" {...bind('maps_url', ids.maps)} onChange={(e) => edit('maps_url', e.target.value)} />
        </Field>
        <Field id={ids.reviews} label="Enlace a Google Reseñas" error={errors.reviews_url}>
          <input type="url" inputMode="url" placeholder="https://g.page/…" {...bind('reviews_url', ids.reviews)} onChange={(e) => edit('reviews_url', e.target.value)} />
        </Field>

        {saveError && (
          <p role="alert" className="flex items-center gap-2 font-medium text-error">
            <AlertIcon className="size-5 shrink-0" />
            {saveError}
          </p>
        )}
        {saved && (
          <p role="status" className="flex items-center gap-2 font-medium text-success">
            <CheckCircleIcon className="size-5 shrink-0" />
            Perfil guardado. Tus clientes ya ven los cambios.
          </p>
        )}
        <button type="submit" disabled={!canSave} className={`${buttonClass} h-14 bg-navy text-white hover:bg-brand sm:self-start`}>
          {save.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  )
}
