import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { api } from '../../shared/api'
import { useAction, useApi, useUnsaved, canDiscardChanges } from '../../shared/hooks'
import type { Submission } from '../../shared/types'
import { date, statuses } from '../../shared/types'
import { Empty, ErrorState, Loading, Notice } from '../../shared/ui'
import { Pagination } from '../../shared/Pagination'

type StaffCourse = {
  id: number
  title: string
  isPublished: boolean
  isArchived: boolean
  students: number
  pending: number
  certificates: number
  mentorName: string
  version: number
}
type Enrollment = {
  id: number
  courseId: number
  courseTitle: string
  studentName: string
  status: string
  decisionReason: string
  requestedAt: string
}
type Review = Submission & { courseId: number; courseTitle: string; studentName: string }
export function StudioPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'courses'
  return (
    <div className="page">
      <p className="eyebrow">КУРСИ, ЛЮДИ ТА ЇХНІ РЕЗУЛЬТАТИ</p>
      <div className="section-heading">
        <h1>Майстерня ментора</h1>
        <Link to="/studio/courses/new" className="button">
          <Plus size={17} />
          Новий курс
        </Link>
      </div>
      <div className="tabs">
        <button
          className={tab === 'courses' ? 'active' : ''}
          onClick={() => setParams({ tab: 'courses' })}
        >
          Курси та статистика
        </button>
        <button
          className={tab === 'enrollments' ? 'active' : ''}
          onClick={() => setParams({ tab: 'enrollments' })}
        >
          Заявки студентів
        </button>
        <button
          className={tab === 'submissions' ? 'active' : ''}
          onClick={() => setParams({ tab: 'submissions' })}
        >
          Перевірка практик
        </button>
      </div>
      {tab === 'enrollments' ? (
        <EnrollmentList />
      ) : tab === 'submissions' ? (
        <ReviewList />
      ) : (
        <StaffCourses />
      )}
    </div>
  )
}
function StaffCourses() {
  const query = useApi<StaffCourse[]>('/staff/courses')
  if (query.loading) return <Loading />
  if (query.error) return <ErrorState error={query.error} retry={query.refresh} />
  if (!query.data?.length)
    return (
      <Empty title="Майстерня починається з програми">
        <p>Створіть курс, додайте матеріали та підготуйте перевірки.</p>
      </Empty>
    )
  return (
    <div className="staff-course-list">
      {query.data.map((c) => (
        <article className="panel" key={c.id}>
          <div className="section-heading">
            <div>
              <span className="badge">
                {c.isArchived ? 'Архів' : c.isPublished ? 'Опубліковано' : 'Чернетка'}
              </span>
              <h2>{c.title}</h2>
              <p className="muted">{c.mentorName}</p>
            </div>
            <Link to={`/studio/courses/${c.id}`} className="button secondary">
              Керувати
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mini-stats">
            <span>
              <strong>{c.students}</strong> студентів
            </span>
            <span>
              <strong>{c.pending}</strong> заявок
            </span>
            <span>
              <strong>{c.certificates}</strong> сертифікатів
            </span>
          </div>
        </article>
      ))}
    </div>
  )
}
function EnrollmentList() {
  const [all, setAll] = useState(false)
  const [page, setPage] = useState(1)
  const query = useApi<{ items: Enrollment[]; total: number }>(
    `/staff/enrollments?page=${page}&all=${all}`,
  )
  if (query.loading) return <Loading />
  if (query.error) return <ErrorState error={query.error} retry={query.refresh} />
  const rows = query.data?.items ?? []
  return (
    <>
      <label className="check-label">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => {
            if (!canDiscardChanges()) return
            setAll(e.target.checked)
            setPage(1)
          }}
        />
        Показати також розглянуті заявки
      </label>
      {!rows.length ? (
        <Empty title="Нових заявок немає" />
      ) : (
        rows.map((e) => <DecisionForm key={e.id} enrollment={e} refresh={query.refresh} />)
      )}
      <Pagination page={page} total={query.data?.total ?? 0} onChange={setPage} />
    </>
  )
}
function DecisionForm({ enrollment: e, refresh }: { enrollment: Enrollment; refresh: () => void }) {
  const action = useAction()
  const [reason, setReason] = useState('')
  useUnsaved((e.status === 'Pending' && Boolean(reason)) || action.pending)
  return (
    <article className="panel">
      <div className="section-heading">
        <div>
          <h3>{e.studentName}</h3>
          <p>{e.courseTitle}</p>
          <small>{date(e.requestedAt)}</small>
        </div>
        <span className="badge">{statuses[e.status]}</span>
      </div>
      {e.status === 'Pending' ? (
        <>
          <label>
            Коментар до рішення (для відмови — від 10 символів)
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={2}
            />
          </label>
          <Notice error={action.error} />
          <div className="actions">
            <button
              className="button"
              disabled={action.pending}
              onClick={() =>
                action.run(async () => {
                  await api.send(`/staff/enrollments/${e.id}/decision`, {
                    status: 'Approved',
                    reason,
                  })
                  setReason('')
                  refresh()
                })
              }
            >
              Схвалити
            </button>
            <button
              className="button secondary"
              disabled={action.pending || reason.trim().length < 10}
              onClick={() =>
                action.run(async () => {
                  await api.send(`/staff/enrollments/${e.id}/decision`, {
                    status: 'Rejected',
                    reason,
                  })
                  setReason('')
                  refresh()
                })
              }
            >
              Відхилити з поясненням
            </button>
          </div>
        </>
      ) : (
        <p>{e.decisionReason}</p>
      )}
    </article>
  )
}
function ReviewList() {
  const [all, setAll] = useState(false)
  const [page, setPage] = useState(1)
  const query = useApi<{ items: Review[]; total: number }>(
    `/staff/submissions?page=${page}&all=${all}`,
  )
  if (query.loading) return <Loading />
  if (query.error) return <ErrorState error={query.error} retry={query.refresh} />
  const rows = query.data?.items ?? []
  return (
    <>
      <label className="check-label">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => {
            if (!canDiscardChanges()) return
            setAll(e.target.checked)
            setPage(1)
          }}
        />
        Показати також перевірені роботи
      </label>
      {!rows.length ? (
        <Empty title="Черга перевірки порожня">
          <p>Надіслані студентами роботи з’являться тут.</p>
        </Empty>
      ) : (
        rows.map((s) => <GradeForm key={s.id} submission={s} refresh={query.refresh} />)
      )}
      <Pagination page={page} total={query.data?.total ?? 0} onChange={setPage} />
    </>
  )
}
function GradeForm({ submission: s, refresh }: { submission: Review; refresh: () => void }) {
  const action = useAction()
  const [dirty, setDirty] = useState(false)
  useUnsaved(dirty || action.pending)
  const [scores, setScores] = useState([0, 0, 0, 0])
  const criteria = [
    ['Коректність', 40],
    ['Обґрунтування', 25],
    ['Перевірки', 25],
    ['Зрозумілість', 10],
  ] as const
  return (
    <article className="panel grade-card">
      <div className="section-heading">
        <div>
          <h2>{s.studentName}</h2>
          <p>
            {s.courseTitle} · {date(s.submittedAt)}
          </p>
        </div>
        <span className="badge">{s.grade === null ? 'На перевірці' : `${s.grade}/100`}</span>
      </div>
      <Link to={`/studio/courses/${s.courseId}`} className="text-link">
        Відкрити завдання й програму курсу
      </Link>
      <pre className="submitted-answer">{s.answer}</pre>
      {s.grade !== null ? (
        <p className="feedback">{s.feedback}</p>
      ) : (
        <form
          onChange={() => setDirty(true)}
          onSubmit={(e) => {
            e.preventDefault()
            const feedback = new FormData(e.currentTarget).get('feedback')
            action.run(async () => {
              await api.send(`/staff/submissions/${s.id}/grade`, {
                correctness: scores[0],
                reasoning: scores[1],
                testing: scores[2],
                clarity: scores[3],
                feedback,
              })
              setDirty(false)
              refresh()
            })
          }}
        >
          <div className="rubric-grid">
            {criteria.map(([name, max], i) => (
              <label key={name}>
                {name} / {max}
                <input
                  type="number"
                  min={0}
                  max={max}
                  required
                  value={scores[i]}
                  onChange={(e) =>
                    setScores((old) => old.map((v, n) => (n === i ? Number(e.target.value) : v)))
                  }
                />
              </label>
            ))}
          </div>
          <p>
            <strong>Разом: {scores.reduce((a, b) => a + b, 0)}/100</strong> · Для зарахування — 60
            балів.
          </p>
          <label>
            Відгук: що вдалося та що покращити
            <textarea name="feedback" rows={4} minLength={20} maxLength={3000} required />
          </label>
          <p className="muted">
            Після збереження оцінка остаточна. Якщо менше 60 — студент зможе надіслати нову версію.
          </p>
          <Notice error={action.error} />
          <button className="button" disabled={action.pending}>
            {action.pending ? 'Зберігаємо…' : 'Зберегти оцінку й відгук'}
          </button>
        </form>
      )}
    </article>
  )
}
