import { lazy } from 'react'
export const CatalogPage = lazy(() =>
  import('../features/catalog/CatalogPage').then((module) => ({ default: module.CatalogPage })),
)
export const AuthPage = lazy(() =>
  import('../features/auth/AuthPage').then((module) => ({ default: module.AuthPage })),
)
export const AccountPage = lazy(() =>
  import('../features/auth/AccountPage').then((module) => ({ default: module.AccountPage })),
)
export const CoursePage = lazy(() =>
  import('../features/learning/CoursePage').then((module) => ({ default: module.CoursePage })),
)
export const DashboardPage = lazy(() =>
  import('../features/learning/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
export const LessonPage = lazy(() =>
  import('../features/learning/LessonPage').then((module) => ({ default: module.LessonPage })),
)
export const QuizPage = lazy(() =>
  import('../features/learning/QuizPage').then((module) => ({ default: module.QuizPage })),
)
export const CertificatePage = lazy(() =>
  import('../features/learning/CertificatePage').then((module) => ({
    default: module.CertificatePage,
  })),
)
export const RankingPage = lazy(() =>
  import('../features/learning/RankingPage').then((module) => ({ default: module.RankingPage })),
)
export const SupportPage = lazy(() =>
  import('../features/support/SupportPage').then((module) => ({ default: module.SupportPage })),
)
export const StudioPage = lazy(() =>
  import('../features/staff/StudioPage').then((module) => ({ default: module.StudioPage })),
)
export const CourseEditorPage = lazy(() =>
  import('../features/staff/CourseEditorPage').then((module) => ({
    default: module.CourseEditorPage,
  })),
)
export const AdminPage = lazy(() =>
  import('../features/staff/AdminPage').then((module) => ({ default: module.AdminPage })),
)
export const AboutPage = lazy(() =>
  import('./AboutPage').then((module) => ({ default: module.AboutPage })),
)
