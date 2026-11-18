import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { AuthContext } from './AuthContext'
import { AuthPage } from './AuthPage'
import { api } from '../../shared/api'

describe('Sign in', () => {
  it('shows a failed login without losing the entered email', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'send').mockRejectedValue(new Error('Невірні дані входу'))
    render(
      <AuthContext.Provider
        value={{ user: null, loading: false, failed: false, setUser: vi.fn(), reload: vi.fn() }}
      >
        <RouterProvider
          router={createMemoryRouter([{ path: '/login', element: <AuthPage /> }], {
            initialEntries: ['/login'],
          })}
        />
      </AuthContext.Provider>,
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Електронна пошта' }),
      'learner@example.test',
    )
    await user.type(screen.getByLabelText('Пароль', { exact: true }), 'wrong but long password')
    await user.click(screen.getByRole('button', { name: 'Увійти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Невірні дані входу')
    expect(screen.getByRole('textbox', { name: 'Електронна пошта' })).toHaveValue(
      'learner@example.test',
    )
  })
})
