export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
// Wrong credentials on these endpoints are also 401, but they do not mean an existing session expired.
const credentialPaths = new Set(['/auth/login', '/auth/register'])
export const sessionExpiredEvent = 'sharpmind:session-expired'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options })
  if (response.status === 401 && !credentialPaths.has(path))
    window.dispatchEvent(new Event(sessionExpiredEvent))
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      title?: string
      errors?: Record<string, string[]>
    } | null
    const fallback =
      response.status === 401
        ? 'Сесія завершилась. Увійдіть до облікового запису.'
        : response.status === 403
          ? 'Для цієї дії немає доступу.'
          : response.status === 429
            ? 'Забагато спроб. Зачекайте та повторіть.'
            : 'Не вдалося виконати запит. Перевірте з’єднання.'
    const validation = problem?.errors ? Object.values(problem.errors).flat().join(' ') : ''
    throw new ApiError(validation || problem?.title || fallback, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  async send<T = void>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    const { token } = await request<{ token: string }>('/auth/csrf')
    return request<T>(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  },
  async upload<T>(path: string, form: FormData): Promise<T> {
    const { token } = await request<{ token: string }>('/auth/csrf')
    return request<T>(path, { method: 'POST', headers: { 'X-CSRF-TOKEN': token }, body: form })
  },
}
export const statusOf = (error: unknown) => (error instanceof ApiError ? error.status : 0)
export const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Не вдалося виконати дію.'
