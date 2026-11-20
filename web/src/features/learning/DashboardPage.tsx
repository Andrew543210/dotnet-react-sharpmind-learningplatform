import { Link } from 'react-router-dom'
import { ArrowRight, Award, BookOpen, Clock3 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../../shared/hooks'
import type { Course } from '../../shared/types'
import { statuses } from '../../shared/types'
import { Empty, ErrorState, Loading, Progress } from '../../shared/ui'

export function DashboardPage() {
  const { user } = useAuth()
  const query = useApi<
    {
      course: Course
      enrollmentStatus: string
      decisionReason: string
      status: { progress: number; certificateId: string | null } | null
    }[]
  >('/courses/mine')
  if (query.loading) return <Loading />
  if (query.error)
    return <ErrorState error={query.error} status={query.status} retry={query.refresh} />
  const rows = query.data ?? []
  const active = rows.filter((x) => x.enrollmentStatus === 'Approved' && !x.status?.certificateId)
  const completed = rows.filter((x) => x.status?.certificateId)
  return (
    <div className="page">
      <p className="eyebrow">ВАШ ОСОБИСТИЙ МАРШРУТ</p>
      <h1>
        Навчання триває, {user?.fullName.split(' ')[0]}
        <span className="accent">.</span>
      </h1>
      <p className="lead">Кожна виконана робота — ще один крок до впевненості.</p>
      <div className="stat-grid">
        <div>
          <BookOpen size={21} />
          <strong>{active.length}</strong>
          <span>активних курсів</span>
        </div>
        <div>
          <Award size={21} />
          <strong>{completed.length}</strong>
          <span>отриманих сертифікатів</span>
        </div>
        <div>
          <Clock3 size={21} />
          <strong>{rows.filter((x) => x.enrollmentStatus === 'Pending').length}</strong>
          <span>заявок на розгляді</span>
        </div>
      </div>
      {!rows.length ? (
        <Empty title="Перший крок — обрати курс">
          <p>Знайдіть навичку, яку хочеться застосувати на практиці.</p>
          <Link to="/" className="button">
            Перейти до каталогу
            <ArrowRight size={16} />
          </Link>
        </Empty>
      ) : (
        <>
          <h2>Ваші курси</h2>
          <div className="dashboard-list">
            {rows.map((x) => (
              <article className="panel dashboard-course" key={x.course.id}>
                <div>
                  <span className="eyebrow">
                    {x.status?.certificateId ? 'КУРС ЗАВЕРШЕНО' : statuses[x.enrollmentStatus]}
                  </span>
                  <h2>
                    <Link to={`/courses/${x.course.id}`}>{x.course.title}</Link>
                  </h2>
                  <p className="muted">Ментор: {x.course.mentorName}</p>
                  {x.decisionReason && <p>{x.decisionReason}</p>}
                  {x.status && <Progress value={x.status.progress} />}
                </div>
                <div className="actions">
                  {x.status?.certificateId && (
                    <Link
                      className="button secondary"
                      to={`/certificates/${x.status.certificateId}`}
                    >
                      Сертифікат
                      <Award size={16} />
                    </Link>
                  )}
                  <Link className="button" to={`/courses/${x.course.id}`}>
                    {x.enrollmentStatus === 'Approved' ? 'Продовжити' : 'Переглянути заявку'}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
