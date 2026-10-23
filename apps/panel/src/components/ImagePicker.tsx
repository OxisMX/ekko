import { type ReactNode, useRef } from 'react'
import { AlertIcon } from './Icons'
import { btnSecondary } from './ui'


// File chooser + optional "remove" action shared by every merchant image field.
export function ImagePicker({ inputLabel, hasImage, uploading, disabled = false, error, errorActions, removeLabel = 'Quitar imagen', onPick, onRemove }: {
  inputLabel: string
  hasImage: boolean
  uploading: boolean
  // Extra lock while the surrounding form saves (the label reads "Subiendo…" only while `uploading`).
  disabled?: boolean
  error: string | null
  // Recovery actions under the error, e.g. "Reintentar" (P-35).
  errorActions?: ReactNode
  removeLabel?: string
  onPick: (file: File | undefined) => void
  onRemove?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label={inputLabel}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          onPick(file)
        }}
      />
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={uploading || disabled} className={btnSecondary} onClick={() => input.current?.click()}>
          {uploading ? 'Subiendo…' : hasImage ? 'Cambiar imagen' : 'Elegir imagen'}
        </button>
        {hasImage && onRemove && (
          <button type="button" disabled={uploading || disabled} className={`${btnSecondary} text-error`} onClick={onRemove}>
            {removeLabel}
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="flex flex-col gap-2 text-sm font-medium text-error">
          <p className="flex items-center gap-1.5">
            <AlertIcon className="size-4 shrink-0" />
            {error}
          </p>
          {errorActions}
        </div>
      )}
    </>
  )
}
