export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number
  total: number
  onChange: (page: number) => void
}) {
  if (total <= 50 && page === 1) return null
  return (
    <nav className="pagination" aria-label="Сторінки списку">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        Попередня
      </button>
      <span>
        {page} · Усього {total}
      </span>
      <button disabled={page * 50 >= total} onClick={() => onChange(page + 1)}>
        Наступна
      </button>
    </nav>
  )
}
