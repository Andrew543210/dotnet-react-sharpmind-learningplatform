import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../shared/hooks'
import type { Course } from '../../shared/types'
import { levels, topics } from '../../shared/types'
import { Empty, ErrorState, Loading } from '../../shared/ui'
import { CourseCard } from './CourseCard'

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const query = useApi<{ items: Course[]; total: number; page: number }>(
    `/courses?${params.toString()}`,
  )
  const set = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  return (
    <div className="page catalog-page">
      <div className="page-intro">
        <p className="eyebrow">
          <span />
          ВІД ЦІКАВОСТІ ДО ВМІННЯ
        </p>
        <h1>
          Наступний крок
          <br />у вашому розвитку<span className="accent">.</span>
        </h1>
        <p className="lead">
          Змістовні уроки. Справжня практика. Підтримка ментора.
          <br className="desktop-break" /> Оберіть напрям і навчайтеся через власні рішення.
        </p>
      </div>
      <section className="learning-banner" aria-label="Формат навчання">
        <div>
          <span className="banner-kicker">ПРАКТИКА МАЄ ЗНАЧЕННЯ</span>
          <h2>
            Навички через практику.
            <br />
            Впевненість через досвід.
          </h2>
          <Link to="/about">
            Як побудоване навчання <ArrowRight size={17} />
          </Link>
        </div>
        <ol className="learning-steps">
          <li>
            <span>01</span>
            <div>
              <strong>Розберіться</strong>
              <small>Уроки з прикладами</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Спробуйте</strong>
              <small>Практичні завдання</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Отримайте відгук</strong>
              <small>Перевірка ментора</small>
            </div>
          </li>
        </ol>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">ОБЕРІТЬ СВІЙ НАПРЯМ</p>
          <h2>
            Каталог курсів <span className="count">{query.data?.total ?? '—'}</span>
          </h2>
        </div>
        <span className="muted">Ваш темп. Чітка програма.</span>
      </div>
      <div className="catalog-toolbar">
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            set('search', String(new FormData(e.currentTarget).get('search') ?? ''))
          }}
        >
          <Search size={19} />
          <input
            name="search"
            key={params.get('search') ?? ''}
            aria-label="Пошук курсу"
            placeholder="Яку навичку хочете опанувати?"
            defaultValue={params.get('search') ?? ''}
          />
          <button type="submit">Знайти</button>
        </form>
        <label className="sort">
          <SlidersHorizontal size={16} />
          <span className="sr-only">Сортувати курси</span>
          <select
            value={params.get('sort') ?? 'title'}
            onChange={(e) => set('sort', e.target.value)}
          >
            <option value="title">За назвою</option>
            <option value="popular">За популярністю</option>
            <option value="newest">Спочатку нові</option>
          </select>
        </label>
      </div>
      <div className="filter-row">
        <div className="topic-filters" aria-label="Напрям">
          <button
            className={!params.get('topic') ? 'selected' : ''}
            onClick={() => set('topic', '')}
          >
            Усі напрями
          </button>
          {Object.entries(topics).map(([key, label]) => (
            <button
              key={key}
              className={params.get('topic') === key ? 'selected' : ''}
              onClick={() => set('topic', key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="level-filter">
          <span className="sr-only">Рівень курсу</span>
          <select value={params.get('level') ?? ''} onChange={(e) => set('level', e.target.value)}>
            <option value="">Усі рівні</option>
            {Object.entries(levels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} status={query.status} retry={query.refresh} />
      ) : query.data?.items.length ? (
        <>
          <div className="course-grid">
            {query.data.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
          {query.data.total > 12 && (
            <div className="pagination">
              <button
                disabled={query.data.page === 1}
                onClick={() => set('page', String(query.data!.page - 1))}
              >
                Попередня
              </button>
              <span>Сторінка {query.data.page}</span>
              <button
                disabled={query.data.page * 12 >= query.data.total}
                onClick={() => set('page', String(query.data!.page + 1))}
              >
                Наступна
              </button>
            </div>
          )}
        </>
      ) : (
        <Empty title="За цими умовами курсів немає">
          <p>Змініть пошук або оберіть інший напрям.</p>
          <button className="button secondary" onClick={() => setParams({})}>
            Очистити фільтри
          </button>
        </Empty>
      )}
    </div>
  )
}
