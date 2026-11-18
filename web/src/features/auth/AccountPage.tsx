import { useAuth } from './AuthContext'
import { api } from '../../shared/api'
import { useAction } from '../../shared/hooks'
import { Notice } from '../../shared/ui'

export function AccountPage() {
  const { user } = useAuth()
  const action = useAction()
  return (
    <div className="page narrow">
      <p className="eyebrow">ОСОБИСТІ НАЛАШТУВАННЯ</p>
      <h1>Ваш обліковий запис</h1>
      <div className="panel">
        <h2>{user?.fullName}</h2>
        <p>{user?.email}</p>
        <p className="muted">
          Ім’я використовується в сертифікаті. Якщо потрібне виправлення, зверніться до підтримки до
          видачі сертифіката.
        </p>
      </div>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const data = new FormData(form)
          action.run(async () => {
            await api.send('/auth/password', {
              currentPassword: data.get('currentPassword'),
              newPassword: data.get('newPassword'),
            })
            form.reset()
          }, 'Пароль змінено. Інші сесії більше не дійсні.')
        }}
      >
        <h2>Змінити пароль</h2>
        <label>
          Поточний пароль
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            maxLength={128}
          />
        </label>
        <label>
          Новий пароль
          <input
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
          />
        </label>
        <p className="muted">Від 15 до 128 символів. Оберіть унікальну фразу.</p>
        <Notice error={action.error} success={action.success} />
        <button className="button" disabled={action.pending}>
          {action.pending ? 'Зберігаємо…' : 'Змінити пароль'}
        </button>
      </form>
    </div>
  )
}
