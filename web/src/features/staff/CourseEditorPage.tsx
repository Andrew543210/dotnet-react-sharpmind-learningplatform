import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { api } from '../../shared/api'
import { useAction, useApi, useUnsaved } from '../../shared/hooks'
import type { Curriculum, Question } from '../../shared/types'
import { levels, topics } from '../../shared/types'
import { useAuth } from '../auth/AuthContext'
import { ErrorState, Loading, Notice } from '../../shared/ui'
import { MediaManager } from './MediaManager'

type Editable = {
  id: number
  slug: string
  title: string
  description: string
  topic: string
  level: string
  isPublished: boolean
  isArchived: boolean
  version: number
  content: Curriculum
  contentLocked: boolean
  mentorId: string
}
const empty: Editable = {
  id: 0,
  slug: '',
  title: '',
  description: '',
  topic: 'Programming',
  level: 'Beginner',
  isPublished: false,
  isArchived: false,
  version: 0,
  content: { outcomes: [], prerequisites: '', modules: [], finalQuestions: [] },
  contentLocked: false,
  mentorId: '',
}
const blankQuestions = (): Question[] =>
  Array.from({ length: 10 }, () => ({
    id: crypto.randomUUID(),
    text: '',
    options: ['', '', '', ''],
    correct: 0,
    explanation: '',
  }))
export function CourseEditorPage() {
  const { id } = useParams()
  return id === 'new' ? <Editor initial={empty} /> : <ExistingEditor id={id!} />
}
function ExistingEditor({ id }: { id: string }) {
  const query = useApi<Editable>(`/staff/courses/${id}`)
  if (query.loading) return <Loading />
  if (query.error || !query.data) return <ErrorState error={query.error} retry={query.refresh} />
  return <Editor key={`${id}-${query.data.version}`} initial={query.data} refresh={query.refresh} />
}
function Editor({ initial, refresh }: { initial: Editable; refresh?: () => void }) {
  const [course, setCourse] = useState(initial)
  const [saved, setSaved] = useState(JSON.stringify(initial))
  const [preview, setPreview] = useState(false)
  const action = useAction()
  const navigate = useNavigate()
  const dirty = JSON.stringify(course) !== saved
  const allowNavigation = useUnsaved(dirty)
  const content = (next: Curriculum) => setCourse((old) => ({ ...old, content: next }))
  const moduleChange = (index: number, next: Curriculum['modules'][number]) =>
    content({
      ...course.content,
      modules: course.content.modules.map((m, i) => (i === index ? next : m)),
    })
  const move = (index: number, delta: number) => {
    const modules = [...course.content.modules]
    ;[modules[index], modules[index + delta]] = [modules[index + delta], modules[index]]
    content({ ...course.content, modules })
  }
  return (
    <div className="page editor-page">
      <Link to="/studio" className="back-link">
        ← До майстерні
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{initial.id ? 'РЕДАГУВАННЯ КУРСУ' : 'НОВА ПРОГРАМА НАВЧАННЯ'}</p>
          <h1>{initial.id ? initial.title : 'Почнімо з ідеї'}</h1>
        </div>
        <span className="badge">
          {dirty
            ? 'Є незбережені зміни'
            : initial.isArchived
              ? 'Архів'
              : initial.isPublished
                ? 'Опубліковано'
                : 'Чернетка'}
        </span>
      </div>
      <Notice error={action.error} success={action.success} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          action.run(async () => {
            if (initial.id) {
              await api.send(`/staff/courses/${initial.id}`, course, 'PUT')
              setSaved(JSON.stringify(course))
              refresh?.()
            } else {
              const created = await api.send<{ id: number }>('/staff/courses', course)
              setSaved(JSON.stringify(course))
              allowNavigation()
              navigate(`/studio/courses/${created.id}`, { replace: true })
            }
          }, 'Чернетку збережено.')
        }}
      >
        <fieldset disabled={action.pending}>
          <section className="panel">
            <h2>Про курс</h2>
            <div className="form-grid">
              <label>
                Назва
                <input
                  value={course.title}
                  onChange={(e) => setCourse({ ...course, title: e.target.value })}
                  minLength={5}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Коротка адреса курсу
                <input
                  value={course.slug}
                  onChange={(e) => setCourse({ ...course, slug: e.target.value })}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={100}
                  required
                  placeholder="react-fundamentals"
                />
              </label>
              <label>
                Напрям
                <select
                  value={course.topic}
                  onChange={(e) => setCourse({ ...course, topic: e.target.value })}
                >
                  {Object.entries(topics).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Рівень
                <select
                  value={course.level}
                  onChange={(e) => setCourse({ ...course, level: e.target.value })}
                >
                  {Object.entries(levels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Опис
              <textarea
                value={course.description}
                onChange={(e) => setCourse({ ...course, description: e.target.value })}
                minLength={40}
                maxLength={2400}
                rows={3}
                required
              />
            </label>
          </section>
          {initial.contentLocked && (
            <p className="notice success">
              За програмою вже навчаються. Матеріали захищено від змін. Для іншої програми створіть
              новий курс; опис і назву можна оновити.
            </p>
          )}
          <fieldset disabled={initial.contentLocked} className="curriculum-editor">
            <section className="panel">
              <h2>Мета й передумови</h2>
              <label>
                Що студент уже має знати
                <textarea
                  value={course.content.prerequisites}
                  onChange={(e) => content({ ...course.content, prerequisites: e.target.value })}
                  maxLength={2000}
                  rows={3}
                />
              </label>
              <label>
                Результати навчання (кожен з нового рядка)
                <textarea
                  value={course.content.outcomes.join('\n')}
                  onChange={(e) =>
                    content({ ...course.content, outcomes: e.target.value.split('\n') })
                  }
                  rows={4}
                />
              </label>
            </section>
            <div className="section-heading">
              <h2>Модулі · {course.content.modules.length}</h2>
              <button
                type="button"
                className="button secondary small"
                disabled={course.content.modules.length >= 20}
                onClick={() =>
                  content({
                    ...course.content,
                    modules: [
                      ...course.content.modules,
                      {
                        key: `module-${crypto.randomUUID()}`,
                        title: '',
                        minutes: 120,
                        lesson: '',
                        practice: '',
                        questions: blankQuestions(),
                      },
                    ],
                  })
                }
              >
                <Plus size={16} />
                Додати модуль
              </button>
            </div>
            {course.content.modules.map((m, i) => (
              <details className="panel module-editor" key={m.key}>
                <summary>
                  {i + 1}. {m.title || 'Новий модуль'}
                </summary>
                <div className="module-controls">
                  <button
                    type="button"
                    aria-label="Перемістити модуль вище"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label="Перемістити модуль нижче"
                    disabled={i === course.content.modules.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() => {
                      if (confirm('Видалити модуль із чернетки?'))
                        content({
                          ...course.content,
                          modules: course.content.modules.filter((_, n) => n !== i),
                        })
                    }}
                  >
                    <Trash2 size={16} />
                    Видалити
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    Назва модуля
                    <input
                      value={m.title}
                      onChange={(e) => moduleChange(i, { ...m, title: e.target.value })}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Час із практикою, хвилини
                    <input
                      type="number"
                      min={20}
                      max={1200}
                      value={m.minutes}
                      onChange={(e) => moduleChange(i, { ...m, minutes: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <label>
                  Матеріал уроку (підтримує Markdown)
                  <textarea
                    className="code-input"
                    value={m.lesson}
                    onChange={(e) => moduleChange(i, { ...m, lesson: e.target.value })}
                    rows={14}
                    maxLength={40000}
                  />
                </label>
                <label>
                  Практична робота: вимоги, приклади та критерії
                  <textarea
                    value={m.practice}
                    onChange={(e) => moduleChange(i, { ...m, practice: e.target.value })}
                    rows={8}
                    maxLength={12000}
                  />
                </label>
                <h3>Тест модуля · 10 питань</h3>
                <QuestionEditor
                  questions={m.questions}
                  onChange={(questions) => moduleChange(i, { ...m, questions })}
                />
              </details>
            ))}
            <section className="panel">
              <h2>Фінальний іспит</h2>
              <p>
                Рівно 10 змістовних питань із поясненнями. Краще перевіряти застосування знань, а не
                повторювати формулювання модульних тестів.
              </p>
              {course.content.finalQuestions.length === 0 && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => content({ ...course.content, finalQuestions: blankQuestions() })}
                >
                  Підготувати 10 питань
                </button>
              )}
              <QuestionEditor
                questions={course.content.finalQuestions}
                onChange={(finalQuestions) => content({ ...course.content, finalQuestions })}
              />
            </section>
          </fieldset>
          <div className="editor-save">
            <button className="button" disabled={action.pending || !dirty}>
              <Save size={17} />
              {action.pending ? 'Зберігаємо…' : 'Зберегти курс'}
            </button>
            <p>
              Чернетка може бути неповною. Перед публікацією перевіряється кожен урок, практична
              робота та тест.
            </p>
          </div>
        </fieldset>
      </form>
      {initial.id > 0 && (
        <section className="panel publish-panel">
          <h2>Публікація та доступ</h2>
          <p>Приховані й архівовані курси залишаються доступними вже зарахованим студентам.</p>
          <div className="actions">
            <button
              className="button"
              disabled={action.pending || dirty || initial.isArchived}
              onClick={() =>
                action.run(
                  async () => {
                    await api.send(
                      `/staff/courses/${initial.id}/publish?version=${initial.version}&published=${!initial.isPublished}`,
                    )
                    refresh?.()
                  },
                  initial.isPublished ? 'Курс приховано з каталогу.' : 'Курс опубліковано.',
                )
              }
            >
              {initial.isPublished ? 'Приховати з каталогу' : 'Опублікувати'}
            </button>
            <button
              className="button secondary"
              disabled={action.pending || dirty}
              onClick={() =>
                action.run(async () => {
                  await api.send(
                    `/staff/courses/${initial.id}/archive?version=${initial.version}&archived=${!initial.isArchived}`,
                  )
                  refresh?.()
                })
              }
            >
              {initial.isArchived ? 'Відновити з архіву' : 'Архівувати'}
            </button>
            <Link className="text-link" to={`/courses/${initial.id}`}>
              Переглянути сторінку
            </Link>
            <button className="text-link" onClick={() => setPreview((v) => !v)}>
              {preview ? 'Приховати матеріали' : 'Переглянути матеріали'}
            </button>
          </div>
          {preview && (
            <div className="editor-preview">
              {course.content.modules.map((m) => (
                <details key={m.key}>
                  <summary>{m.title}</summary>
                  <h3>Урок</h3>
                  <pre>{m.lesson}</pre>
                  <h3>Практична робота</h3>
                  <pre>{m.practice}</pre>
                </details>
              ))}
            </div>
          )}
        </section>
      )}
      {initial.id > 0 && (
        <MediaManager
          courseId={initial.id}
          modules={initial.content.modules}
          locked={initial.contentLocked}
        />
      )}
      {initial.id > 0 && <MentorAssignment course={initial} refresh={refresh!} />}
    </div>
  )
}
function QuestionEditor({
  questions,
  onChange,
}: {
  questions: Question[]
  onChange: (questions: Question[]) => void
}) {
  const update = (index: number, question: Question) =>
    onChange(questions.map((q, i) => (i === index ? question : q)))
  return (
    <div className="question-editor">
      {questions.map((q, i) => (
        <details key={q.id}>
          <summary>
            Питання {i + 1}: {q.text || 'додайте формулювання'}
          </summary>
          <label>
            Питання
            <textarea
              value={q.text}
              onChange={(e) => update(i, { ...q, text: e.target.value })}
              maxLength={1000}
              rows={2}
            />
          </label>
          {q.options.map((o, n) => (
            <label key={n}>
              Варіант {n + 1}
              <input
                value={o}
                onChange={(e) =>
                  update(i, {
                    ...q,
                    options: q.options.map((v, j) => (j === n ? e.target.value : v)),
                  })
                }
                maxLength={1000}
              />
            </label>
          ))}
          <label>
            Правильний варіант
            <select
              value={q.correct}
              onChange={(e) => update(i, { ...q, correct: Number(e.target.value) })}
            >
              {q.options.map((_, n) => (
                <option key={n} value={n}>
                  {n + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Пояснення правильної відповіді
            <textarea
              value={q.explanation}
              onChange={(e) => update(i, { ...q, explanation: e.target.value })}
              maxLength={2000}
              rows={3}
            />
          </label>
        </details>
      ))}
    </div>
  )
}
function MentorAssignment({ course, refresh }: { course: Editable; refresh: () => void }) {
  const { user } = useAuth()
  return user?.role === 'Admin' ? <AssignmentForm course={course} refresh={refresh} /> : null
}
function AssignmentForm({ course, refresh }: { course: Editable; refresh: () => void }) {
  const query = useApi<{ id: string; fullName: string }[]>('/admin/mentors')
  const action = useAction()
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault()
        const mentorId = new FormData(e.currentTarget).get('mentorId')
        action.run(async () => {
          await api.send(`/admin/courses/${course.id}/mentor`, {
            mentorId,
            version: course.version,
          })
          refresh()
        })
      }}
    >
      <h2>Призначення ментора</h2>
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refresh} />
      ) : (
        <>
          <label>
            Відповідальний ментор
            <select name="mentorId" defaultValue={course.mentorId}>
              {query.data?.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>
          <Notice error={action.error} />
          <button className="button secondary" disabled={action.pending}>
            Призначити
          </button>
        </>
      )}
    </form>
  )
}
