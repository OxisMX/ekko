import { useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { LogoutIcon } from './Icons'
import { ModalDialog } from './ModalDialog'
import { btnDanger, btnSecondary, btnSmall } from './ui'

// P-14: signing out drops the whole till, so it always asks first (focus starts on "Cancelar").
export function LogoutButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btnSmall} flex items-center gap-2`}>
        <LogoutIcon className="size-4" />
        Cerrar sesión
      </button>
      {open && <LogoutDialog onClose={() => setOpen(false)} />}
    </>
  )
}

// WHY separate: useAuth throws outside AuthProvider, so it is only read once the dialog is open.
function LogoutDialog({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth()
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <ModalDialog labelledBy="logout-title" onClose={onClose} initialFocusRef={cancelRef}>
      <h2 id="logout-title" className="text-h2 font-semibold">
        ¿Cerrar sesión?
      </h2>
      <p className="text-text-secondary">La caja quedará sin sesión y tendrás que entrar de nuevo con el correo y la contraseña del negocio.</p>
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" onClick={() => void signOut()} className={`${btnDanger} sm:flex-1`}>
          Cerrar sesión
        </button>
        <button ref={cancelRef} type="button" onClick={onClose} className={`${btnSecondary} sm:flex-1`}>
          Cancelar
        </button>
      </div>
    </ModalDialog>
  )
}
