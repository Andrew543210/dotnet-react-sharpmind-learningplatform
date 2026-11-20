import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { useListParams, useUnsaved, useUnsavedNavigation } from './hooks'

function EditableForm({ name }: { name: string }) {
  const [value, setValue] = useState('')
  useUnsaved(Boolean(value))
  return (
    <label>
      {name}
      <input value={value} onChange={(e) => setValue(e.target.value)} />
    </label>
  )
}
function EditingPage() {
  useUnsavedNavigation()
  return (
    <>
      <EditableForm name="First reply" />
      <EditableForm name="Second reply" />
      <Link to="?tab=history">History tab</Link>
      <Link to="/other">Other page</Link>
    </>
  )
}
function setup() {
  const router = createMemoryRouter([
    { path: '/', element: <EditingPage /> },
    { path: '/other', element: <h1>Other destination</h1> },
  ])
  render(<RouterProvider router={router} />)
  return router
}

it('protects every dirty form and query navigation until changes are cleared', async () => {
  const user = userEvent.setup()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const router = setup()
  await user.type(screen.getByLabelText('First reply'), 'One')
  await user.type(screen.getByLabelText('Second reply'), 'Two')
  await user.click(screen.getByRole('link', { name: 'Other page' }))
  expect(router.state.location.pathname).toBe('/')
  expect(screen.getByLabelText('First reply')).toHaveValue('One')
  await user.clear(screen.getByLabelText('First reply'))
  await user.click(screen.getByRole('link', { name: 'History tab' }))
  expect(router.state.location.search).toBe('')
  expect(screen.getByLabelText('Second reply')).toHaveValue('Two')
  expect(confirm).toHaveBeenCalledTimes(2)
  await user.clear(screen.getByLabelText('Second reply'))
  await user.click(screen.getByRole('link', { name: 'Other page' }))
  expect(await screen.findByRole('heading', { name: 'Other destination' })).toBeInTheDocument()
  expect(confirm).toHaveBeenCalledTimes(2)
})

it('guards closing the tab and permits confirmed navigation', async () => {
  const user = userEvent.setup()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  setup()
  await user.type(screen.getByLabelText('Second reply'), 'Draft')
  const closing = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(closing)
  expect(closing.defaultPrevented).toBe(true)
  await user.click(screen.getByRole('link', { name: 'Other page' }))
  expect(await screen.findByRole('heading', { name: 'Other destination' })).toBeInTheDocument()
  expect(confirm).toHaveBeenCalledTimes(1)
})

function ListPage() {
  const { params, page, update, setPage } = useListParams()
  return (
    <>
      <p>
        page {page} · all {params.get('all') ?? 'no'} · tab {params.get('tab') ?? 'none'}
      </p>
      <button onClick={() => setPage(page + 1)}>Next page</button>
      <button onClick={() => update({ all: 'true' })}>Show all</button>
    </>
  )
}

it('keeps the list page and filters in the URL and restarts paging after a filter change', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter([{ path: '/', element: <ListPage /> }], {
    initialEntries: ['/?tab=enrollments&page=0'],
  })
  render(<RouterProvider router={router} />)
  expect(screen.getByText('page 1 · all no · tab enrollments')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(router.state.location.search).toBe('?tab=enrollments&page=2')
  await user.click(screen.getByRole('button', { name: 'Show all' }))
  expect(router.state.location.search).toBe('?tab=enrollments&all=true')
  await router.navigate(-1)
  expect(await screen.findByText('page 2 · all no · tab enrollments')).toBeInTheDocument()
})
