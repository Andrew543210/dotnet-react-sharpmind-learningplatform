import {
  CatalogPage,
  AuthPage,
  AccountPage,
  CoursePage,
  DashboardPage,
  LessonPage,
  QuizPage,
  CertificatePage,
  RankingPage,
  SupportPage,
  StudioPage,
  CourseEditorPage,
  AdminPage,
  AboutPage,
} from './pages'
import { createBrowserRouter, Link } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthProvider'
import { Shell } from './Shell'
import { Empty, Protected } from '../shared/ui'

export const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <Shell />
      </AuthProvider>
    ),
    errorElement: (
      <div className="page">
        <h1>Не вдалося відкрити сторінку</h1>
        <p>
          Оновіть сторінку або поверніться до каталогу. Незавершена чернетка практики залишиться в
          цій вкладці.
        </p>
        <a className="button" href="/">
          До каталогу
        </a>
      </div>
    ),
    children: [
      { path: '/', element: <CatalogPage /> },
      { path: '/login', element: <AuthPage /> },
      { path: '/register', element: <AuthPage register /> },
      { path: '/courses/:id', element: <CoursePage /> },
      {
        path: '/my-learning',
        element: (
          <Protected roles={['Student']}>
            <DashboardPage />
          </Protected>
        ),
      },
      {
        path: '/learn/:id/:key',
        element: (
          <Protected roles={['Student']}>
            <LessonPage />
          </Protected>
        ),
      },
      {
        path: '/quiz/:id/:key',
        element: (
          <Protected roles={['Student']}>
            <QuizPage />
          </Protected>
        ),
      },
      {
        path: '/courses/:id/ranking',
        element: (
          <Protected roles={['Student']}>
            <RankingPage />
          </Protected>
        ),
      },
      { path: '/certificates/:id', element: <CertificatePage /> },
      {
        path: '/support',
        element: (
          <Protected>
            <SupportPage />
          </Protected>
        ),
      },
      {
        path: '/account',
        element: (
          <Protected>
            <AccountPage />
          </Protected>
        ),
      },
      {
        path: '/studio',
        element: (
          <Protected roles={['Mentor', 'Admin']}>
            <StudioPage />
          </Protected>
        ),
      },
      {
        path: '/studio/courses/:id',
        element: (
          <Protected roles={['Mentor', 'Admin']}>
            <CourseEditorPage />
          </Protected>
        ),
      },
      {
        path: '/admin',
        element: (
          <Protected roles={['Admin']}>
            <AdminPage />
          </Protected>
        ),
      },
      { path: '/about', element: <AboutPage /> },
      {
        path: '*',
        element: (
          <Empty title="Сторінку не знайдено">
            <Link to="/" className="button">
              До каталогу
            </Link>
          </Empty>
        ),
      },
    ],
  },
])
