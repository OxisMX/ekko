import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PageState } from './PageState'

it('keeps the h1 and announces loading', () => {
  render(<PageState title="Perfil" loadingLabel="Cargando el perfil…" />)
  expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando el perfil…')
})

it('keeps the h1 on error and retries', () => {
  const onRetry = vi.fn()
  render(<PageState title="Perfil" loadingLabel="" error="Sin conexión" onRetry={onRetry} />)
  expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})
