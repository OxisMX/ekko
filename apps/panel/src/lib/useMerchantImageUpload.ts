import { ERRORS } from '@ekko/shared'
import * as Sentry from '@sentry/react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useMerchantSession } from '../components/panelOutlet'
import { useAdminRpc } from './adminUnlockContext'
import { describeError, imageErrorText, uploadMerchantImage } from './cardConfig'
import { createImageVariants, type ImageKind, ImageProcessingError } from './imageVariants'

// Resizes in the browser, uploads under merchants/{id}/{folder}/ and keeps a preview of the cropped result.
// Resolves the stored base path, or null when it failed (the message lives in `error`).
export function useMerchantImageUpload(kind: ImageKind, folder: Parameters<typeof uploadMerchantImage>[1]) {
  const { merchant } = useMerchantSession()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const adminRpc = useAdminRpc()
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const replacePreview = (next: string | null) =>
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return next
    })

  async function pick(file: File | undefined): Promise<string | null> {
    if (!file) return null
    setError(null)
    setUploading(true)
    try {
      const variants = await createImageVariants(file, kind)
      const path = await adminRpc(() => uploadMerchantImage(merchant.id, folder, variants))
      if (!path) throw new ImageProcessingError('ENCODE_FAILED', 'Sin ruta')
      // Preview the cropped result, not the raw file, so the merchant sees what customers will.
      replacePreview(URL.createObjectURL(variants[variants.length - 1].blob))
      return path
    } catch (err) {
      const { code } = describeError(err)
      if (code === 'E-05') void queryClient.invalidateQueries({ queryKey: ['merchant-session'] })
      if (code === 'E-18' || code === 'E-19') void signOut(code)
      setError(err instanceof ImageProcessingError ? imageErrorText[err.code] : ERRORS[code].message)
      if (!(err instanceof ImageProcessingError)) Sentry.captureException(err)
      return null
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    replacePreview(null)
    setError(null)
  }

  return { preview, error, uploading, pick, reset }
}
