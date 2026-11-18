import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { CatalogPage } from './CatalogPage'
import { api } from '../../shared/api'

describe('Catalog filters', () => {
  it('applies filters to the URL and gives a useful empty state', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'get').mockResolvedValue({ items: [], total: 0, page: 1 })
    const router = createMemoryRouter([{ path: '/', element: <CatalogPage /> }])
    render(<RouterProvider router={router} />)
    expect(
      await screen.findByRole('heading', { name: 'За цими умовами курсів немає' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'DevOps' }))
    expect(router.state.location.search).toContain('topic=DevOps')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Рівень курсу' }), 'Intermediate')
    expect(router.state.location.search).toContain('level=Intermediate')
    await user.click(await screen.findByRole('button', { name: 'Очистити фільтри' }))
    expect(router.state.location.search).toBe('')
  })

  it('distinguishes an unavailable API from an empty catalog and permits retry', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValueOnce(new Error('Немає з’єднання'))
      .mockResolvedValue({ items: [], total: 0, page: 1 })
    render(
      <RouterProvider router={createMemoryRouter([{ path: '/', element: <CatalogPage /> }])} />,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Немає з’єднання')
    await userEvent.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(
      await screen.findByRole('heading', { name: 'За цими умовами курсів немає' }),
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })
})
