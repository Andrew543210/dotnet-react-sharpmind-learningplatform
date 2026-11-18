import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { QuizPage } from './QuizPage'
import { api } from '../../shared/api'

describe('Quiz workflow', () => {
  it('requires all ten answers and submits once while preserving the server result', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'get').mockResolvedValue({
      key: 'state',
      passScore: 70,
      attempts: [],
      questions: Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`,
        text: `Question ${i + 1}`,
        options: Array.from({ length: 4 }, (_, n) => ({ value: n, text: `Answer ${i + 1}-${n}` })),
      })),
    })
    let resolve: (value: unknown) => void = () => {}
    const send = vi.spyOn(api, 'send').mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const router = createMemoryRouter([{ path: '/quiz/:id/:key', element: <QuizPage /> }], {
      initialEntries: ['/quiz/1/state'],
    })
    render(<RouterProvider router={router} />)
    const submit = await screen.findByRole('button', { name: 'Завершити тест' })
    expect(submit).toBeDisabled()
    for (let i = 0; i < 10; i++) await user.click(screen.getByLabelText(`Answer ${i + 1}-0`))
    expect(submit).toBeEnabled()
    await user.dblClick(submit)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Перевіряємо…' })).toBeDisabled()
    resolve({ score: 80, feedback: [] })
    expect(await screen.findByRole('heading', { name: 'Знання підтверджено' })).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('retains chosen answers when the server rejects a request', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'get').mockResolvedValue({
      key: 'state',
      passScore: 70,
      attempts: [],
      questions: Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`,
        text: `Question ${i}`,
        options: [{ value: 0, text: `Choice ${i}` }],
      })),
    })
    vi.spyOn(api, 'send').mockRejectedValue(new Error('Потрібно зачекати 60 секунд.'))
    render(
      <RouterProvider
        router={createMemoryRouter([{ path: '/quiz/:id/:key', element: <QuizPage /> }], {
          initialEntries: ['/quiz/1/state'],
        })}
      />,
    )
    for (let i = 0; i < 10; i++)
      await user.click(await screen.findByRole('radio', { name: `Choice ${i}` }))
    await user.click(screen.getByRole('button', { name: 'Завершити тест' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('60 секунд')
    expect(screen.getAllByRole('radio').every((r) => (r as HTMLInputElement).checked)).toBe(true)
    expect(screen.getByRole('button', { name: 'Завершити тест' })).toBeEnabled()
  })
})
