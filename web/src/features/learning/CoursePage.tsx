import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, LockKeyhole } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { CourseCover } from '../catalog/CourseCard'
import { api } from '../../shared/api'
import { useAction, useApi } from '../../shared/hooks'
import type { CourseDetail } from '../../shared/types'
import { duration, levels, statuses, topics } from '../../shared/types'
import { ErrorState, Loading, Notice, Progress } from '../../shared/ui'

export function CoursePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const query = useApi<CourseDetail>(`/courses/${id}`)
  const action = useAction()
  const navigate = useNavigate()
  if (query.loading) return <Loading />
  if (query.error || !query.data) return <ErrorState error={query.error} retry={query.refresh} />
  const { course, outcomes, prerequisites, modules, enrollment, status } = query.data
  const approved = enrollment?.status === 'Approved'
  return (
    <div className="page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />
        Усі курси
      </Link>
      <div className="detail-layout">
        <div>
          <div className="card-tags">
            <span>{topics[course.topic]}</span>
            <span>{levels[course.level]}</span>
          </div>
          <h1 className="course-title">{course.title}</h1>
          <p className="lead">{course.description}</p>
          <div className="detail-meta">
            <span>
              <Clock3 size={17} />
              {duration(course.minutes)} з практикою
            </span>
            <span>{modules.length} модулі</span>
            <span>Ментор: {course.mentorName}</span>
          </div>
          <section className="panel outcomes">
            <h2>Що ви зможете після курсу</h2>
            <ul>
              {outcomes.map((x) => (
                <li key={x}>
                  <CheckCircle2 size={19} />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
            <h3>Перед початком</h3>
            <p>{prerequisites}</p>
          </section>
          <section className="syllabus">
            <div className="section-heading">
              <h2>Програма навчання</h2>
              <span className="muted">Крок за кроком</span>
            </div>
            {modules.map((m, i) => {
              const state = status?.modules.find((x) => x.key === m.key)
              const done = state?.read && state.quizScore >= 70 && state.practiceGrade >= 60
              return (
                <div className="syllabus-row" key={m.key}>
                  <span className={`module-number ${done ? 'done' : ''}`}>
                    {done ? <Check size={18} /> : String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>
                      {approved ? <Link to={`/learn/${id}/${m.key}`}>{m.title}</Link> : m.title}
                    </h3>
                    <p>{duration(m.minutes)} · урок, тест із 10 питань, практична робота</p>
                    {state && (
                      <small>
                        Урок {state.read ? '✓' : '—'} · Тест {state.quizScore}% · Практика{' '}
                        {state.practiceGrade}%
                      </small>
                    )}
                  </div>
                  {approved ? (
                    <Link
                      className="icon-link"
                      aria-label={`Відкрити ${m.title}`}
                      to={`/learn/${id}/${m.key}`}
                    >
                      <ArrowRight size={19} />
                    </Link>
                  ) : (
                    <LockKeyhole size={17} className="muted" />
                  )}
                </div>
              )
            })}
            <div className="syllabus-row">
              <span className="module-number">↗</span>
              <div>
                <h3>Фінальний іспит</h3>
                <p>10 питань · прохідний результат 80%</p>
              </div>
              {status?.finalUnlocked ? (
                <Link className="button secondary small" to={`/quiz/${id}/final`}>
                  Скласти
                </Link>
              ) : (
                <LockKeyhole size={17} className="muted" />
              )}
            </div>
          </section>
          {approved && (
            <div className="panel">
              <h2>Власний прогрес, спільний рух</h2>
              <p>
                Рейтинг відображає найкращі оцінки за тести й практику. Імена інших студентів
                приховано.
              </p>
              <Link to={`/courses/${id}/ranking`} className="text-link">
                Переглянути рейтинг <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
        <aside className="course-aside">
          <CourseCover course={course} />
          <div className="panel enrollment-panel">
            <span className="eyebrow">НАВЧАННЯ З МЕНТОРОМ</span>
            <h2>Безкоштовно</h2>
            <p>Повні матеріали, перевірка робіт і сертифікат за результатами.</p>
            {status && (
              <>
                <Progress value={status.progress} />
                <p className="muted">Фінальний тест: {status.finalScore}%</p>
              </>
            )}
            <Notice error={action.error} success={action.success} />
            {!user ? (
              <Link className="button full" to={`/login?next=/courses/${id}`}>
                Увійти й подати заявку
                <ArrowRight size={17} />
              </Link>
            ) : user.role !== 'Student' ? (
              <Link className="button secondary full" to="/studio">
                До майстерні
              </Link>
            ) : approved ? (
              <>
                <Link
                  className="button full"
                  to={`/learn/${id}/${modules.find((m) => !status?.modules.find((s) => s.key === m.key)?.read)?.key ?? modules[0]?.key}`}
                >
                  Продовжити навчання
                  <ArrowRight size={17} />
                </Link>
                {status?.certificateId ? (
                  <Link
                    className="button secondary full"
                    to={`/certificates/${status.certificateId}`}
                  >
                    Ваш сертифікат
                  </Link>
                ) : (
                  status?.canCertify && (
                    <button
                      className="button secondary full"
                      disabled={action.pending}
                      onClick={() =>
                        action.run(async () => {
                          const cert = await api.send<{ id: string }>(`/learning/${id}/certificate`)
                          navigate(`/certificates/${cert.id}`)
                        })
                      }
                    >
                      Отримати сертифікат
                    </button>
                  )
                )}
              </>
            ) : enrollment?.status === 'Pending' ? (
              <p className="notice success">
                Заявка на розгляді. Ментор відкриє доступ після схвалення.
              </p>
            ) : (
              <>
                <button
                  className="button full"
                  disabled={action.pending}
                  onClick={() =>
                    action.run(async () => {
                      await api.send(`/courses/${id}/enroll`)
                      query.refresh()
                    }, 'Заявку надіслано ментору.')
                  }
                >
                  {action.pending
                    ? 'Надсилаємо…'
                    : enrollment?.status === 'Rejected'
                      ? 'Подати заявку повторно'
                      : 'Подати заявку'}
                  <ArrowRight size={17} />
                </button>
                {enrollment?.status === 'Rejected' && (
                  <p className="notice error">
                    {statuses.Rejected}: {enrollment.decisionReason}
                  </p>
                )}
              </>
            )}
            <div className="certificate-rules">
              <h3>Сертифікат — за ваш результат</h3>
              <ul>
                <li>Прочитайте всі уроки.</li>
                <li>Складіть кожен модульний тест на 70% або більше.</li>
                <li>Отримайте від 60% за кожну практику.</li>
                <li>Складіть фінальний іспит від 80%.</li>
              </ul>
              <p>Повторні спроби дозволені. Найкращі результати зберігаються.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
