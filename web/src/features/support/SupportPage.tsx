import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../shared/api'
import { useAction, useApi, useDraft, useUnsaved } from '../../shared/hooks'
import { date } from '../../shared/types'
import { Empty, ErrorState, Loading, Notice } from '../../shared/ui'
import { Pagination } from '../../shared/Pagination'

type Ticket = {
  id: string
  subject: string
  message: string
  reply: string
  createdAt: string
  resolvedAt: string | null
  userName: string
}
export function SupportPage() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const query = useApi<{ items: Ticket[]; total: number }>(`/support?page=${page}`)
  const [body, setBody] = useDraft(`support:${user!.id}`)
  const [subject, setSubject] = useState('')
  useUnsaved(Boolean(subject))
  const [requestId, setRequestId] = useState(crypto.randomUUID())
  const action = useAction()
  return (
    <div className="page">
      <p className="eyebrow">МИ НА ЗВ’ЯЗКУ</p>
      <h1>Підтримка</h1>
      <p className="lead">
        Питання про доступ, навчання або роботу платформи.
        <br />
        Відповідь з’явиться тут, у вашому зверненні.
      </p>
      <div className="support-layout">
        <section>
          <h2>{user?.role === 'Admin' ? 'Звернення користувачів' : 'Ваші звернення'}</h2>
          {query.loading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error} retry={query.refresh} />
          ) : !query.data?.items.length ? (
            <Empty title="Поки що без звернень">
              <p>Якщо потрібна допомога, напишіть нам.</p>
            </Empty>
          ) : (
            query.data.items.map((t) => (
              <article className="panel ticket" key={t.id}>
                <span className={`badge ${t.resolvedAt ? 'green' : ''}`}>
                  {t.resolvedAt ? 'Вирішено' : 'Очікує відповіді'}
                </span>
                <h3>{t.subject}</h3>
                <small>
                  {date(t.createdAt)}
                  {user?.role === 'Admin' && ` · ${t.userName}`}
                </small>
                <p className="preserve-lines">{t.message}</p>
                {t.reply ? (
                  <div className="ticket-reply">
                    <strong>Відповідь підтримки</strong>
                    <p className="preserve-lines">{t.reply}</p>
                  </div>
                ) : (
                  user?.role === 'Admin' && <ReplyForm ticket={t} refresh={query.refresh} />
                )}
              </article>
            ))
          )}
          <Pagination page={page} total={query.data?.total ?? 0} onChange={setPage} />
        </section>
        <form
          className="panel support-form"
          onSubmit={(e) => {
            e.preventDefault()
            action.run(async () => {
              await api.send('/support', { requestId, subject, message: body })
              setSubject('')
              setBody('')
              setRequestId(crypto.randomUUID())
              setPage(1)
              query.refresh()
            }, 'Звернення надіслано. Відповідь з’явиться в цьому розділі.')
          }}
        >
          <h2>Нове звернення</h2>
          <label>
            Тема
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                setRequestId(crypto.randomUUID())
              }}
              minLength={5}
              maxLength={120}
              required
            />
          </label>
          <label>
            Що трапилося?
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                setRequestId(crypto.randomUUID())
              }}
              minLength={20}
              maxLength={4000}
              rows={8}
              required
            />
          </label>
          <p className="muted">
            Опишіть кроки та очікуваний результат. Не надсилайте пароль або платіжні дані.
          </p>
          <Notice error={action.error} success={action.success} />
          <button className="button full" disabled={action.pending}>
            {action.pending ? 'Надсилаємо…' : 'Надіслати звернення'}
          </button>
        </form>
      </div>
    </div>
  )
}
function ReplyForm({ ticket, refresh }: { ticket: Ticket; refresh: () => void }) {
  const action = useAction()
  const [dirty, setDirty] = useState(false)
  useUnsaved(dirty || action.pending)
  return (
    <form
      onChange={() => setDirty(true)}
      onSubmit={(e) => {
        e.preventDefault()
        const reply = new FormData(e.currentTarget).get('reply')
        action.run(async () => {
          await api.send(`/support/${ticket.id}/reply`, { reply })
          setDirty(false)
          refresh()
        })
      }}
    >
      <label>
        Відповідь
        <textarea name="reply" minLength={20} maxLength={4000} required rows={4} />
      </label>
      <Notice error={action.error} />
      <button className="button small" disabled={action.pending}>
        Відповісти й закрити
      </button>
    </form>
  )
}
