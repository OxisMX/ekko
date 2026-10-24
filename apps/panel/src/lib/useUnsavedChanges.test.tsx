import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { expect, it } from 'vitest'
import { UnsavedChangesDialog } from '../components/UnsavedChanges'
import { useUnsavedChanges } from './useUnsavedChanges'

function Form({ dirty }: { dirty: boolean }) {
  const { blocker } = useUnsavedChanges(dirty)
  return (
    <>
      <Link to="/otra">Salir</Link>
      <UnsavedChangesDialog blocker={blocker} />
    </>
  )
}

function setup(dirty: boolean) {
  const router = createMemoryRouter([
    { path: '/', element: <Form dirty={dirty} /> },
    { path: '/otra', element: <p>Otra página</p> },
  ])
  render(<RouterProvider router={router} />)
}

it('navigates freely when nothing changed', async () => {
  setup(false)
  await userEvent.click(screen.getByText('Salir'))
  expect(screen.getByText('Otra página')).toBeInTheDocument()
})

it('asks first when dirty; "Seguir editando" stays, "Salir sin guardar" leaves', async () => {
  const user = userEvent.setup()
  setup(true)
  await user.click(screen.getByText('Salir'))
  expect(screen.getByRole('dialog', { name: 'Tienes cambios sin guardar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Seguir editando' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Seguir editando' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Otra página')).not.toBeInTheDocument()

  await user.click(screen.getByText('Salir'))
  await user.click(screen.getByRole('button', { name: 'Salir sin guardar' }))
  expect(screen.getByText('Otra página')).toBeInTheDocument()
})
