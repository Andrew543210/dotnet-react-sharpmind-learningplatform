import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { api } from '../../shared/api'
import { useAction, useApi, useUnsaved } from '../../shared/hooks'
import { date } from '../../shared/types'
import { ErrorState, Loading, Notice } from '../../shared/ui'

type Quiz = {
  key: string
  passScore: number
  questions: { id: string; text: string; options: { value: number; text: string }[] }[]
  attempts: { id: string; score: number; submittedAt: string }[]
}
type Result = {
  score: number
  feedback: {
    id: string
    text: string
    selected: number
    correct: number
    options: string[]
    explanation: string
  }[]
}
export function QuizPage() {
  const { id, key } = useParams()
  const query = useApi<Quiz>(`/learning/${id}/quizzes/${key}`)
  if (query.loading) return <Loading />
  if (query.error || !query.data) return <ErrorState error={query.error} retry={query.refresh} />
  return <QuizForm key={`${id}-${key}`} quiz={query.data} courseId={id!} />
}
function QuizForm({ quiz, courseId }: { quiz: Quiz; courseId: string }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [requestId, setRequestId] = useState(crypto.randomUUID())
  const [result, setResult] = useState<Result | null>(null)
  const action = useAction()
  const passed = quiz.attempts.some((a) => a.score >= quiz.passScore)
  useUnsaved(Object.keys(answers).length > 0 && !result)
  return (
    <div className="page quiz-page">
      <Link className="back-link" to={`/courses/${courseId}`}>
        <ArrowLeft size={16} />
        До програми курсу
      </Link>
      <p className="eyebrow">ПЕРЕВІРКА РОЗУМІННЯ</p>
      <h1>{quiz.key === 'final' ? 'Фінальний іспит' : 'Тест модуля'}</h1>
      <p className="lead">
        10 питань · одна правильна відповідь · прохідний результат {quiz.passScore}%.
      </p>
      <p className="muted">
        Між спробами — 60 секунд. До {quiz.key === 'final' ? '5' : '10'} спроб за 24 години. Кращий
        результат зберігається.
      </p>
      {passed && !result ? (
        <div className="panel result-card">
          <CheckCircle2 size={32} />
          <h2>Тест уже складено</h2>
          <p>Ваш найкращий результат: {Math.max(...quiz.attempts.map((a) => a.score))}%.</p>
          <Link className="button" to={`/courses/${courseId}`}>
            Продовжити навчання
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : result ? (
        <>
          <div className="panel result-card">
            <span className="result-score">{result.score}%</span>
            <h2>
              {result.score >= quiz.passScore ? 'Знання підтверджено' : 'Є над чим попрацювати'}
            </h2>
            <p>
              {result.score >= quiz.passScore
                ? 'Результат збережено. Продовжуйте свій маршрут.'
                : 'Перегляньте пояснення, поверніться до уроку й спробуйте ще раз.'}
            </p>
            <Link className="button" to={`/courses/${courseId}`}>
              До програми
              <ArrowRight size={16} />
            </Link>
            {result.score < quiz.passScore && (
              <button
                className="button secondary"
                onClick={() => {
                  setAnswers({})
                  setResult(null)
                  setRequestId(crypto.randomUUID())
                }}
              >
                Нова спроба
              </button>
            )}
          </div>
          <div className="quiz-feedback">
            {result.feedback.map((q, i) => (
              <div
                className={`panel ${q.correct === q.selected ? 'correct' : 'incorrect'}`}
                key={q.id}
              >
                <h3>
                  {i + 1}. {q.text}
                </h3>
                <p>Ваша відповідь: {q.options[q.selected]}</p>
                {q.correct !== q.selected && (
                  <p>
                    <strong>Правильна: {q.options[q.correct]}</strong>
                  </p>
                )}
                <p className="muted">{q.explanation}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            action.run(async () =>
              setResult(
                await api.send<Result>(`/learning/${courseId}/quizzes/${quiz.key}`, {
                  requestId,
                  answers,
                }),
              ),
            )
          }}
        >
          <div className="quiz-count" role="status">
            Відповідей: {Object.keys(answers).length} / {quiz.questions.length}
          </div>
          {quiz.questions.map((q, i) => (
            <fieldset className="panel question" key={q.id}>
              <legend>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {q.text}
              </legend>
              {q.options.map((o) => (
                <label className={answers[q.id] === o.value ? 'chosen' : ''} key={o.value}>
                  <input
                    type="radio"
                    name={q.id}
                    value={o.value}
                    checked={answers[q.id] === o.value}
                    onChange={() => {
                      setAnswers((old) => ({ ...old, [q.id]: o.value }))
                      setRequestId(crypto.randomUUID())
                    }}
                    required
                  />
                  {o.text}
                </label>
              ))}
            </fieldset>
          ))}
          <Notice error={action.error} />
          <button
            className="button"
            disabled={action.pending || Object.keys(answers).length !== quiz.questions.length}
          >
            {action.pending ? 'Перевіряємо…' : 'Завершити тест'}
            <ArrowRight size={17} />
          </button>
        </form>
      )}
      {quiz.attempts.length > 0 && (
        <details className="panel attempt-history">
          <summary>Історія спроб ({quiz.attempts.length})</summary>
          <ul>
            {quiz.attempts.map((a) => (
              <li key={a.id}>
                {date(a.submittedAt)} — {a.score}%
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
