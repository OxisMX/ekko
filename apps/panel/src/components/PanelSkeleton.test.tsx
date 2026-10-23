import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { InsideAdminFrame } from '../lib/insideAdminFrame'
import { PanelSkeleton } from './PanelSkeleton'

const at = (path: string, inFrame = false) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <InsideAdminFrame value={inFrame}>
        <PanelSkeleton />
      </InsideAdminFrame>
    </MemoryRouter>,
  ).container

it('P-18: matches the destination — cashier at /, admin frame under /admin, content only inside the frame', () => {
  expect(at('/').querySelector('[data-skeleton="cashier"]')).not.toBeNull()
  expect(at('/admin/menu').querySelector('[data-skeleton="admin"]')).not.toBeNull()
  expect(at('/admin/menu', true).querySelector('[data-skeleton]')).toBeNull()
})
