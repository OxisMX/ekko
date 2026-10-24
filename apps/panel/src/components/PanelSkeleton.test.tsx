import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { PanelSkeleton } from './PanelSkeleton'

const at = (path: string, variant?: 'section') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PanelSkeleton variant={variant} />
    </MemoryRouter>,
  ).container

it('P-18: matches the destination — cashier at /, admin frame under /admin, content only for the section variant', () => {
  expect(at('/').querySelector('[data-skeleton="cashier"]')).not.toBeNull()
  expect(at('/admin/menu').querySelector('[data-skeleton="admin"]')).not.toBeNull()
  expect(at('/admin/menu', 'section').querySelector('[data-skeleton]')).toBeNull()
})
