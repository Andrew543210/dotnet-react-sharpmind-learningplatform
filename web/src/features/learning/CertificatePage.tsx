import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Copy, Printer } from 'lucide-react'
import { useApi } from '../../shared/hooks'
import { date } from '../../shared/types'
import { ErrorState, Loading, Notice } from '../../shared/ui'

export function CertificatePage() {
  const { id } = useParams()
  const query = useApi<{
    id: string
    fullName: string
    courseTitle: string
    mentorName: string
    finalScore: number
    issuedAt: string
  }>(`/certificates/${id}`)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  if (query.loading) return <Loading />
  if (query.error || !query.data)
    return <ErrorState error={query.error} status={query.status} retry={query.refresh} />
  const c = query.data
  return (
    <div className="page certificate-page">
      <Link to="/my-learning" className="back-link no-print">
        <ArrowLeft size={16} />
        Моє навчання
      </Link>
      <div className="certificate">
        <div className="certificate-brand">
          <img src="/brand-mark.svg" alt="" width="42" height="42" />
          SharpMind<span>ПРАКТИЧНІ ЗНАННЯ</span>
        </div>
        <div className="certificate-type">СЕРТИФІКАТ ПРО ЗАВЕРШЕННЯ</div>
        <p>Підтверджуємо, що</p>
        <h1>{c.fullName}</h1>
        <p>успішно завершив(ла) навчання за програмою</p>
        <h2>{c.courseTitle}</h2>
        <div className="certificate-divider" />
        <p>Усі уроки завершено · модульні тести ≥70% · практичні роботи ≥60%</p>
        <p className="certificate-score">
          Фінальний іспит: <strong>{c.finalScore}%</strong>
        </p>
        <div className="certificate-signatures">
          <div>
            <small>Ментор</small>
            <strong>{c.mentorName}</strong>
          </div>
          <div>
            <small>Дата видачі</small>
            <strong>{date(c.issuedAt)}</strong>
          </div>
        </div>
        <div className="certificate-verification">
          <CheckCircle2 size={18} />
          <span>Справжність підтверджено · № {c.id}</span>
        </div>
        <small>
          Свідоцтво завершення програми SharpMind. Не є документом про державну акредитацію.
        </small>
      </div>
      <Notice error={error} success={copied ? 'Посилання скопійовано.' : ''} />
      <div className="actions no-print">
        <button className="button" onClick={() => window.print()}>
          <Printer size={17} />
          Друк / зберегти PDF
        </button>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href)
              setCopied(true)
            } catch {
              setError('Копіювання недоступне. Скопіюйте адресу з рядка браузера.')
            }
          }}
        >
          <Copy size={17} />
          Посилання для перевірки
        </button>
      </div>
      <p className="muted no-print">
        Особа, якій ви надаєте посилання, побачить ім’я, курс і результат. Електронна пошта та
        роботи залишаються приватними.
      </p>
    </div>
  )
}
