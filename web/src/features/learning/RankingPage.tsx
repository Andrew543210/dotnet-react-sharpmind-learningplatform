import { Link, useParams } from 'react-router-dom'
import { useApi } from '../../shared/hooks'
import { Empty, ErrorState, Loading } from '../../shared/ui'

export function RankingPage() {
  const { id } = useParams()
  const query = useApi<{ rank: number; alias: string; isMe: boolean; points: number }[]>(
    `/courses/${id}/ranking`,
  )
  if (query.loading) return <Loading />
  if (query.error)
    return <ErrorState error={query.error} status={query.status} retry={query.refresh} />
  return (
    <div className="page narrow">
      <Link className="back-link" to={`/courses/${id}`}>
        ← До курсу
      </Link>
      <p className="eyebrow">ПРОГРЕС СПІЛЬНОТИ</p>
      <h1>Рейтинг курсу</h1>
      <p className="lead">
        Сума найкращих результатів тестів і практичних робіт. До 100 учасників; навчання має власний
        темп.
      </p>
      {query.data?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Місце</th>
                <th>Учасник</th>
                <th>Бали</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((x) => (
                <tr className={x.isMe ? 'me-row' : ''} key={x.alias}>
                  <td>{x.rank}</td>
                  <td>
                    {x.alias}
                    {x.isMe && <strong> · це ви</strong>}
                  </td>
                  <td>{x.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Результатів ще немає" />
      )}
    </div>
  )
}
