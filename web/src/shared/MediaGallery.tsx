export type Media = {
  id: string
  title: string
  contentType: string
  transcript: string
  length: number
  moduleKey?: string
}
export function MediaGallery({ items }: { items: Media[] }) {
  if (!items.length) return null
  return (
    <section className="media-gallery" aria-label="Фото та відеоматеріали">
      {items.map((m) => (
        <figure key={m.id}>
          {m.contentType.startsWith('image/') ? (
            <img src={`/api/media/${m.id}`} alt={m.title} loading="lazy" />
          ) : (
            <>
              <video src={`/api/media/${m.id}`} controls preload="metadata" aria-label={m.title} />
              <details>
                <summary>Текстова версія відео</summary>
                <p className="preserve-lines">{m.transcript}</p>
              </details>
            </>
          )}
          <figcaption>{m.title}</figcaption>
        </figure>
      ))}
    </section>
  )
}
