import { Suspense, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { api } from '../shared/api'
import { useAction, useUnsavedNavigation } from '../shared/hooks'
import { Loading, Notice } from '../shared/ui'

export function Shell() {
  useUnsavedNavigation()
  const { user, setUser } = useAuth()
  const location = useLocation()
  const main = useRef<HTMLElement>(null)
  const action = useAction()
  const logout = () => {
    const safe = window.dispatchEvent(new Event('sharpmind:check-unsaved', { cancelable: true }))
    if (!safe && !window.confirm('Є незбережені зміни. Вийти й видалити локальні чернетки?')) return
    return action.run(async () => {
      await api.send('/auth/logout')
      sessionStorage.clear()
      setUser(null)
    })
  }
  useEffect(() => {
    window.scrollTo(0, 0)
    main.current?.focus()
  }, [location.pathname])
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Перейти до вмісту
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="SharpMind — каталог">
          <img className="brand-icon" src="/brand-mark.svg" alt="" width="38" height="38" />
          <span>
            SharpMind<span className="brand-sub">навчання з практикою</span>
          </span>
        </Link>
        <p className="nav-caption">ВАШ ПРОСТІР</p>
        <nav aria-label="Основна навігація">
          <NavLink to="/" end>
            <BookOpen size={19} />
            Каталог курсів
          </NavLink>
          {(!user || user.role === 'Student') && (
            <NavLink to="/my-learning">
              <GraduationCap size={19} />
              Моє навчання
            </NavLink>
          )}
          {user && user.role !== 'Student' && (
            <NavLink to="/studio">
              <LayoutDashboard size={19} />
              Майстерня ментора
            </NavLink>
          )}
          {user?.role === 'Admin' && (
            <NavLink to="/admin">
              <ShieldCheck size={19} />
              Користувачі
            </NavLink>
          )}
          <NavLink to="/support">
            <CircleHelp size={19} />
            Підтримка
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <span className="little-rule" />
          <strong>
            Знати. Спробувати.
            <br />
            Зрозуміти.
          </strong>
          <p>
            Теорія набуває сенсу,
            <br />
            коли стає вашим рішенням.
          </p>
          <Link to="/about">
            Як це працює <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-account">
          {user ? (
            <>
              <Link to="/account" className="account-link">
                <span className="avatar">{user.fullName.slice(0, 1)}</span>
                <span>
                  <strong>{user.fullName}</strong>
                  <small>
                    {user.role === 'Student'
                      ? 'Студент'
                      : user.role === 'Mentor'
                        ? 'Ментор'
                        : 'Адміністратор'}
                  </small>
                </span>
                <Settings size={16} />
              </Link>
              <button className="logout" disabled={action.pending} onClick={logout}>
                <LogOut size={16} />
                Вийти
              </button>
            </>
          ) : (
            <Link to="/login" className="account-link">
              <UserRound size={20} />
              <span>Увійти в кабінет</span>
              <ArrowUpRight size={17} />
            </Link>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Навчальна платформа <span className="topbar-divider">/</span>{' '}
            <strong>
              {location.pathname.startsWith('/studio')
                ? 'Майстерня'
                : location.pathname === '/'
                  ? 'Каталог'
                  : 'Особистий простір'}
            </strong>
          </span>
          <div className="topbar-actions">
            <span className="language">UA</span>
            {!user && (
              <Link to="/register" className="button small">
                Створити акаунт <ArrowUpRight size={15} />
              </Link>
            )}
            {user && (
              <div className="mobile-account">
                <Link to="/account" aria-label="Налаштування облікового запису">
                  <UserRound size={17} />
                </Link>
                <button aria-label="Вийти" disabled={action.pending} onClick={logout}>
                  <LogOut size={17} />
                </button>
              </div>
            )}
          </div>
        </header>
        <main id="main" ref={main} tabIndex={-1}>
          <Notice error={action.error} />
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
        <footer>
          <Link to="/">SharpMind</Link>
          <span>Малі кроки. Відчутний результат.</span>
          <Link to="/about">Про навчання та приватність</Link>
        </footer>
      </div>
    </div>
  )
}
