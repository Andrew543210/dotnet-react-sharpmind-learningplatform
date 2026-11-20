import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../shared/api'
import { useAction, useApi, useListParams, useUnsaved } from '../../shared/hooks'
import { Pagination } from '../../shared/Pagination'
import type { Role, User } from '../../shared/types'
import { Empty, ErrorState, Loading, Notice } from '../../shared/ui'

type Account = User & { isDisabled: boolean }
export function AdminPage() {
  const { params, page, update, setPage } = useListParams()
  const search = params.get('search') ?? ''
  const query = useApi<{ total: number; items: Account[] }>(
    `/admin/users?search=${encodeURIComponent(search)}&page=${page}`,
  )
  return (
    <div className="page">
      <p className="eyebrow">АДМІНІСТРУВАННЯ</p>
      <h1>Користувачі та доступи</h1>
      <p className="lead">
        Нові користувачі реєструються студентами. Призначайте менторів із зареєстрованих облікових
        записів.
      </p>
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault()
          update({ search: String(new FormData(e.currentTarget).get('search') ?? '').trim() })
        }}
      >
        <input
          key={search}
          name="search"
          defaultValue={search}
          aria-label="Знайти користувача"
          maxLength={100}
          placeholder="Ім’я або пошта"
        />
        <button>Знайти</button>
      </form>
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} status={query.status} retry={query.refresh} />
      ) : !query.data?.items.length ? (
        <Empty title="Користувачів не знайдено" />
      ) : (
        <>
          <div className="admin-users">
            {query.data.items.map((u) => (
              <UserForm key={u.id} user={u} refresh={query.refresh} />
            ))}
          </div>
          <Pagination page={page} total={query.data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
function UserForm({ user, refresh }: { user: Account; refresh: () => void }) {
  const auth = useAuth()
  const [role, setRole] = useState<Role>(user.role)
  const [disabled, setDisabled] = useState(user.isDisabled)
  const action = useAction()
  useUnsaved(role !== user.role || disabled !== user.isDisabled || action.pending)
  return (
    <form
      className="panel user-row"
      onSubmit={(e) => {
        e.preventDefault()
        action.run(async () => {
          await api.send(`/admin/users/${user.id}`, { role, isDisabled: disabled }, 'PUT')
          refresh()
        }, 'Права збережено.')
      }}
    >
      <div>
        <h3>{user.fullName}</h3>
        <p>{user.email}</p>
      </div>
      <fieldset disabled={user.id === auth.user?.id || action.pending}>
        <label>
          Роль
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="Student">Студент</option>
            <option value="Mentor">Ментор</option>
            <option value="Admin">Адміністратор</option>
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
          />
          Обліковий запис заблоковано
        </label>
        <button
          className="button secondary small"
          disabled={role === user.role && disabled === user.isDisabled}
        >
          Зберегти
        </button>
      </fieldset>
      <Notice error={action.error} success={action.success} />
    </form>
  )
}
