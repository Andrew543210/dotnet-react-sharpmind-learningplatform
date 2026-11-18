import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from './AuthContext'
import { api } from '../../shared/api'
import type { User } from '../../shared/types'
import { useAction, useUnsaved } from '../../shared/hooks'
import { Notice } from '../../shared/ui'

export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, setUser } = useAuth()
  const action = useAction()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [show, setShow] = useState(false)
  const [dirty, setDirty] = useState(false)
  const allowNavigation = useUnsaved(dirty && !user)
  if (user)
    return (
      <div className="page narrow">
        <h1>Ви вже увійшли</h1>
        <Link className="button" to={user.role === 'Student' ? '/my-learning' : '/studio'}>
          До свого простору <ArrowRight size={17} />
        </Link>
      </div>
    )
  return (
    <div className="page auth-page">
      <div className="auth-story">
        <p className="eyebrow">SHARPMIND / ОСОБИСТИЙ ПРОСТІР</p>
        <h1>{register ? 'Ваша наступна навичка — тут.' : 'Добре, що ви повернулися.'}</h1>
        <p>
          Продовжуйте з того місця, де зупинилися.
          <br />
          Уроки, роботи й відгуки — в одному просторі.
        </p>
        <div className="auth-decoration" aria-hidden="true">
          {'{ learn; build; repeat; }'}
        </div>
      </div>
      <div className="auth-form panel">
        <p className="eyebrow">{register ? 'ПОЧНІМО ЗІ ЗНАЙОМСТВА' : 'ВАШЕ НАВЧАННЯ ЧЕКАЄ'}</p>
        <h2>{register ? 'Створити акаунт' : 'Увійти в SharpMind'}</h2>
        <form
          onChange={() => setDirty(true)}
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            action.run(async () => {
              const value = await api.send<User>(register ? '/auth/register' : '/auth/login', {
                email: form.get('email'),
                password: form.get('password'),
                ...(register ? { fullName: form.get('fullName') } : {}),
              })
              allowNavigation()
              setUser(value)
              const next = params.get('next')
              navigate(
                next?.startsWith('/') &&
                  !next.startsWith('//') &&
                  !next.startsWith('/login') &&
                  !next.startsWith('/register')
                  ? next
                  : value.role === 'Student'
                    ? '/my-learning'
                    : '/studio',
                { replace: true },
              )
            })
          }}
        >
          {register && (
            <label>
              Повне ім’я
              <input
                name="fullName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Як вас звати?"
              />
            </label>
          )}
          <label>
            Електронна пошта
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Пароль
            <div className="password-field">
              <input
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                minLength={register ? 15 : 1}
                maxLength={128}
                aria-describedby={register ? 'password-help' : undefined}
              />
              <button
                type="button"
                aria-label={show ? 'Приховати пароль' : 'Показати пароль'}
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {register && (
            <small id="password-help">
              Від 15 до 128 символів. Довга унікальна фраза добре підходить.
            </small>
          )}
          <Notice error={action.error} />
          <button className="button full" disabled={action.pending}>
            {action.pending ? 'Зачекайте…' : register ? 'Створити акаунт' : 'Увійти'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? 'Уже маєте акаунт?' : 'Ще не з нами?'}{' '}
          <Link
            to={`${register ? '/login' : '/register'}${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`}
          >
            {register ? 'Увійти' : 'Зареєструватися'}
          </Link>
        </p>
        <p className="fine-print">
          Реєструючись, ви створюєте обліковий запис студента.{' '}
          <Link to="/about">Як ми зберігаємо дані</Link>.
        </p>
      </div>
    </div>
  )
}
