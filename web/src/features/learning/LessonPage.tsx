import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import { ArrowLeft, ArrowRight, Check, FileCode2 } from 'lucide-react'
import { api } from '../../shared/api'
import { useAction, useApi, useDraft } from '../../shared/hooks'
import { useAuth } from '../auth/AuthContext'
import type { CourseDetail, LearningStatus } from '../../shared/types'
import { date } from '../../shared/types'
import { ErrorState, Loading, Notice, Progress } from '../../shared/ui'
import { MediaGallery } from '../../shared/MediaGallery'
import type { Media } from '../../shared/MediaGallery'

export function LessonPage() {
  const { id, key } = useParams()
  const query = useApi<{
    key: string
    title: string
    lesson: string
    practice: string
    status: LearningStatus
    media: Media[]
  }>(`/learning/${id}/modules/${key}`)
  const course = useApi<CourseDetail>(`/courses/${id}`)
  if (query.loading || course.loading) return <Loading />
  if (query.error || course.error || !query.data || !course.data)
    return (
      <ErrorState
        error={query.error || course.error}
        retry={() => {
          query.refresh()
          course.refresh()
        }}
      />
    )
  return (
    <LessonContent
      key={`${id}-${key}`}
      lesson={query.data}
      course={course.data}
      refresh={query.refresh}
    />
  )
}
function LessonContent({
  lesson,
  course,
  refresh,
}: {
  lesson: {
    key: string
    title: string
    lesson: string
    practice: string
    status: LearningStatus
    media: Media[]
  }
  course: CourseDetail
  refresh: () => void
}) {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'lesson'
  const setTab = (value: string) => setParams({ tab: value }, { replace: true })
  const [answer, setAnswer] = useDraft(`practice:${user!.id}:${course.course.id}:${lesson.key}`)
  const [requestId, setRequestId] = useState(crypto.randomUUID())
  const action = useAction()
  const state = lesson.status.modules.find((x) => x.key === lesson.key)!
  const history = lesson.status.submissions.filter((s) => s.moduleKey === lesson.key)
  const latest = history[0]
  const canSubmit = !latest || (latest.grade !== null && latest.grade < 60)
  const next = course.modules[course.modules.findIndex((m) => m.key === lesson.key) + 1]
  return (
    <div className="page lesson-page">
      <Link className="back-link" to={`/courses/${course.course.id}`}>
        <ArrowLeft size={16} />
        {course.course.title}
      </Link>
      <div className="lesson-layout">
        <aside className="lesson-outline">
          <p className="eyebrow">ВАШ МАРШРУТ</p>
          <Progress value={lesson.status.progress} />
          <nav aria-label="Модулі курсу">
            {course.modules.map((m, i) => (
              <Link
                key={m.key}
                className={m.key === lesson.key ? 'current' : ''}
                to={`/learn/${course.course.id}/${m.key}`}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                {m.title}
              </Link>
            ))}
          </nav>
          <p className="muted">Тести ≥70% · практика ≥60% · фінальний іспит ≥80%</p>
          <Link className="text-link" to={`/courses/${course.course.id}`}>
            Загальний прогрес
            <ArrowRight size={15} />
          </Link>
        </aside>
        <article className="lesson-content">
          <div className="lesson-top">
            <span className="eyebrow">
              МОДУЛЬ {course.modules.findIndex((m) => m.key === lesson.key) + 1} /{' '}
              {course.modules.length}
            </span>
            <span className="muted">{state.read ? 'Урок прочитано ✓' : 'У вашому темпі'}</span>
          </div>
          <h1>{lesson.title}</h1>
          <div className="tabs" aria-label="Вміст модуля">
            <button className={tab === 'lesson' ? 'active' : ''} onClick={() => setTab('lesson')}>
              Матеріал
            </button>
            <button
              className={tab === 'practice' ? 'active' : ''}
              onClick={() => setTab('practice')}
            >
              Практична робота
            </button>
            <Link to={`/quiz/${course.course.id}/${lesson.key}`}>
              Тест · {state.quizScore}%<ArrowRight size={14} />
            </Link>
          </div>
          <Notice error={action.error} success={action.success} />
          {tab === 'lesson' ? (
            <>
              <div className="prose">
                <Markdown>{lesson.lesson}</Markdown>
                <MediaGallery items={lesson.media} />
              </div>
              <div className="lesson-complete">
                <div>
                  <h2>{state.read ? 'Ще один крок зроблено' : 'Розібралися з матеріалом?'}</h2>
                  <p>Закріпіть його тестом і власним рішенням.</p>
                </div>
                <button
                  className="button"
                  disabled={state.read || action.pending}
                  onClick={() =>
                    action.run(async () => {
                      await api.send(`/learning/${course.course.id}/modules/${lesson.key}/complete`)
                      refresh()
                    }, 'Урок позначено прочитаним.')
                  }
                >
                  <Check size={17} />
                  {state.read ? 'Прочитано' : 'Позначити прочитаним'}
                </button>
              </div>
              <div className="actions">
                <Link className="button secondary" to={`/quiz/${course.course.id}/${lesson.key}`}>
                  До тесту
                  <ArrowRight size={16} />
                </Link>
                <button className="text-link" onClick={() => setTab('practice')}>
                  До практики
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="prose">
                <Markdown>{lesson.practice}</Markdown>
              </div>
              {history.length > 0 && (
                <section className="submission-history">
                  <h2>Ваші роботи та відгуки</h2>
                  {history.map((s) => (
                    <details className="panel" key={s.id} open={s.id === latest?.id}>
                      <summary>
                        {date(s.submittedAt)} ·{' '}
                        {s.grade === null
                          ? 'Очікує перевірки'
                          : `${s.grade}/100 — ${s.grade >= 60 ? 'Зараховано' : 'Потребує доопрацювання'}`}
                      </summary>
                      <pre className="submitted-answer">{s.answer}</pre>
                      {s.feedback && (
                        <>
                          <h3>Відгук ментора</h3>
                          <p className="feedback">{s.feedback}</p>
                          <p className="muted">
                            Критерії: {JSON.parse(s.rubricJson).join(' / ')} балів
                          </p>
                        </>
                      )}
                    </details>
                  ))}
                </section>
              )}
              {canSubmit ? (
                <form
                  className="panel practice-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    action.run(async () => {
                      await api.send(
                        `/learning/${course.course.id}/modules/${lesson.key}/submissions`,
                        { requestId, answer },
                      )
                      setAnswer('')
                      setRequestId(crypto.randomUUID())
                      refresh()
                    }, 'Роботу надіслано. Ментор залишить оцінку й відгук.')
                  }}
                >
                  <h2>
                    <FileCode2 size={22} />
                    Ваше рішення
                  </h2>
                  <label htmlFor="practice-answer">Код, пояснення та перевірки</label>
                  <textarea
                    id="practice-answer"
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value)
                      setRequestId(crypto.randomUUID())
                    }}
                    minLength={80}
                    maxLength={20000}
                    rows={14}
                    required
                    spellCheck={false}
                    aria-describedby="draft-help"
                  />
                  <p id="draft-help" className="muted">
                    {answer.length}/20000 символів · Чернетка відновлюється в цій вкладці. Не
                    додавайте секрети.
                  </p>
                  <button className="button" disabled={action.pending}>
                    {action.pending ? 'Надсилаємо…' : 'Надіслати ментору'}
                    <ArrowRight size={17} />
                  </button>
                </form>
              ) : (
                <p className="notice success">
                  {latest.grade === null
                    ? 'Робота в черзі перевірки. Результат з’явиться тут.'
                    : 'Практику зараховано. Ваш результат збережено.'}
                </p>
              )}
            </>
          )}
          {next && (
            <Link className="next-module" to={`/learn/${course.course.id}/${next.key}`}>
              <span>
                <small>НАСТУПНИЙ МОДУЛЬ</small>
                <strong>{next.title}</strong>
              </span>
              <ArrowRight size={22} />
            </Link>
          )}
        </article>
      </div>
    </div>
  )
}
