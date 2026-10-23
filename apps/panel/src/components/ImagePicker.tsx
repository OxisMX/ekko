import { useRef } from 'react'
import { AlertIcon } from './Icons'

const buttonClass = 'min-h-12 rounded-xl px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40'

// File chooser + optional "remove" action shared by every merchant image field.
export function ImagePicker({ inputLabel, hasImage, uploading, error, removeLabel, onPick, onRemove }: {
  inputLabel: string
  hasImage: boolean
  uploading: boolean
  error: string | null
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
        <button type="button" disabled={uploading} className={`${buttonClass} border border-black/15 hover:bg-surface-muted`} onClick={() => input.current?.click()}>
          {uploading ? 'Subiendo…' : hasImage ? 'Cambiar imagen' : 'Elegir imagen'}
        </button>
        {hasImage && onRemove && (
          <button type="button" disabled={uploading} className={`${buttonClass} text-error hover:bg-surface-muted`} onClick={onRemove}>
            {removeLabel}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-error">
          <AlertIcon className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </>
  )
}
