import { useRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ModalDialog } from './ModalDialog'

function setup() {
  const onClose = vi.fn()
  render(
    <>
      <button>Abrir</button>
      <ModalDialog labelledBy="t" onClose={onClose}>
        <h2 id="t">Título</h2>
        <button>Uno</button>
        <button>Dos</button>
      </ModalDialog>
    </>,
  )
  return onClose
}

it('focuses the dialog, keeps Tab inside it in both directions and closes with Escape', async () => {
  const user = userEvent.setup()
  const onClose = setup()
  expect(screen.getByRole('dialog', { name: 'Título' })).toHaveFocus()

  await user.tab()
  expect(screen.getByText('Uno')).toHaveFocus()
  await user.tab()
  await user.tab()
  expect(screen.getByText('Uno')).toHaveFocus() // wrapped from the last to the first
  await user.tab({ shift: true })
  expect(screen.getByText('Dos')).toHaveFocus() // wrapped from the first to the last

  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('focuses initialFocusRef instead of the dialog when given', () => {
  function WithRef() {
    const cancel = useRef<HTMLButtonElement>(null)
    return (
      <ModalDialog labelledBy="t" onClose={() => {}} initialFocusRef={cancel}>
        <h2 id="t">Título</h2>
        <button ref={cancel}>Cancelar</button>
        <button>Eliminar</button>
      </ModalDialog>
    )
  }
  render(<WithRef />)
  expect(screen.getByText('Cancelar')).toHaveFocus()
})
