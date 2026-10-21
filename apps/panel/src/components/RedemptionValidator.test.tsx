import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { RedemptionValidator } from './RedemptionValidator'

it('normalizes lowercase input into two groups and enables submit only for valid codes', async () => {
  const user = userEvent.setup()
  render(<RedemptionValidator />)
  const input = screen.getByLabelText('Código')
  const submit = screen.getByRole('button', { name: 'Validar código' })

  await user.type(input, 'k7m 4q')
  expect(input).toHaveValue('K7M 4Q')
  expect(submit).toBeDisabled()

  await user.type(input, 'x')
  expect(input).toHaveValue('K7M 4QX')
  expect(submit).toBeEnabled()

  // 0 and O are excluded from the alphabet.
  await user.clear(input)
  await user.type(input, 'k7m4q0')
  expect(input).toHaveValue('K7M 4Q0')
  expect(submit).toBeDisabled()
  expect(input).toHaveAttribute('aria-invalid', 'true')
})
