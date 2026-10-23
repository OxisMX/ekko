import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Switch } from './ui'

it('Switch exposes its state and toggles through onChange', () => {
  const onChange = vi.fn()
  const { rerender } = render(<Switch label="Agotado: Café" text="Agotado" checked={false} onChange={onChange} />)
  const control = screen.getByRole('switch', { name: 'Agotado: Café' })
  expect(control).toHaveAttribute('aria-checked', 'false')
  expect(control).toHaveClass('bg-text-secondary')
  fireEvent.click(control)
  expect(onChange).toHaveBeenCalledWith(true)
  rerender(<Switch label="Agotado: Café" checked onChange={onChange} />)
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
})
