import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertCircle, ArrowRight, BookOpen, RotateCw } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import type { Role } from './types'

export function Loading() {
  return (
    <div className="state" role="status">
      <span className="spinner" />
      Завантажуємо дані…
    </div>
  )
}
export function ErrorState({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="state error-state" role="alert">
      <AlertCircle size={28} />
      <h2>Не вдалося відкрити дані</h2>
      <p>{error}</p>
      <div className="actions">
        {retry && (
          <button className="button secondary" onClick={retry}>
            <RotateCw size={16} />
            Повторити
          </button>
        )}
        <Link to="/login" className="text-link">
          Перейти до входу
        </Link>
      </div>
    </div>
  )
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state empty">
      <BookOpen size={30} />
      <h2>{title}</h2>
      {children}
    </div>
  )
}
export function Notice({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="notice success" role="status">
          {success}
        </p>
      )}
    </>
  )
}
export function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading, failed, reload } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (failed) return <ErrorState error="Немає з’єднання із сервером." retry={reload} />
  if (!user)
    return (
      <Empty title="Продовжимо після входу">
        <p>Ваш прогрес і роботи зберігатимуться в особистому кабінеті.</p>
        <Link className="button" to={`/login?next=${encodeURIComponent(location.pathname)}`}>
          Увійти <ArrowRight size={16} />
        </Link>
      </Empty>
    )
  if (roles && !roles.includes(user.role))
    return (
      <Empty title="Ця сторінка для іншої ролі">
        <p>У вас немає доступу до цього розділу.</p>
        <Link to="/" className="button secondary">
          До каталогу
        </Link>
      </Empty>
    )
  return children
}
export function Progress({ value }: { value: number }) {
  return (
    <div className="progress-wrap">
      <progress value={value} max={100} aria-label={`Прогрес ${value}%`} />
      <span>{value}%</span>
    </div>
  )
}
