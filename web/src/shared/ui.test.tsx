import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, it } from 'vitest'
import { ErrorState } from './ui'

function show(status: number) {
  const router = createMemoryRouter(
    [
      {
        path: '/learn/:id',
        element: <ErrorState error="Server text" status={status} retry={() => {}} />,
      },
    ],
    { initialEntries: ['/learn/4?tab=practice'] },
  )
  render(<RouterProvider router={router} />)
}

it('offers a login that returns to the same page after a 401', () => {
  show(401)
  expect(screen.getByRole('heading', { name: 'Потрібно увійти' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Увійти' })).toHaveAttribute(
    'href',
    '/login?next=%2Flearn%2F4%3Ftab%3Dpractice',
  )
  expect(screen.queryByRole('button', { name: 'Повторити' })).not.toBeInTheDocument()
})

it('does not suggest a retry or a login for a missing resource', () => {
  show(404)
  expect(screen.getByRole('link', { name: 'До каталогу' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Повторити' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Увійти' })).not.toBeInTheDocument()
})

it('keeps the retry for network and server failures', () => {
  show(0)
  expect(screen.getByRole('heading', { name: 'Не вдалося відкрити дані' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Повторити' })).toBeInTheDocument()
})
