import { useRef } from 'react'
import { api } from '../../shared/api'
import { useAction, useApi, useUnsaved } from '../../shared/hooks'
import { ErrorState, Loading, Notice } from '../../shared/ui'
import { MediaGallery } from '../../shared/MediaGallery'
import type { Media } from '../../shared/MediaGallery'

export function MediaManager({
  courseId,
  modules,
  locked,
}: {
  courseId: number
  modules: { key: string; title: string }[]
  locked: boolean
}) {
  const query = useApi<Media[]>(`/media/course/${courseId}`)
  const action = useAction()
  useUnsaved(action.pending)
  const form = useRef<HTMLFormElement>(null)
  return (
    <section className="panel">
      <h2>Фото та відеоматеріали</h2>
      <p className="muted">
        PNG, JPEG, WebP — до 5 МіБ. MP4, WebM — до 100 МіБ. До 100 файлів на курс. Завантажуйте
        власні матеріали або ті, на які маєте право використання; вкажіть автора в підписі, якщо це
        потрібно.
      </p>
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refresh} />
      ) : (
        <div>
          {query.data?.map((m) => (
            <div className="media-item" key={m.id}>
              <p className="eyebrow">
                {modules.find((x) => x.key === m.moduleKey)?.title ?? 'Модуль'}
              </p>
              <MediaGallery items={[m]} />
              <div className="actions">
                <span className="muted">{(m.length / 1048576).toFixed(2)} МіБ</span>
                <button
                  className="button secondary small"
                  disabled={locked || action.pending}
                  onClick={() => {
                    if (confirm('Видалити цей медіаматеріал?'))
                      action.run(async () => {
                        await api.send(`/media/${m.id}`, undefined, 'DELETE')
                        query.refresh()
                      })
                  }}
                >
                  Видалити файл
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!locked && modules.length > 0 && (
        <form
          ref={form}
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            const key = String(data.get('moduleKey'))
            data.delete('moduleKey')
            action.run(async () => {
              await api.upload(`/media/course/${courseId}/modules/${key}`, data)
              form.current?.reset()
              query.refresh()
            }, 'Медіаматеріал завантажено.')
          }}
        >
          <fieldset disabled={action.pending}>
            <h3>Додати матеріал до збереженого модуля</h3>
            <label>
              Модуль
              <select name="moduleKey" required>
                {modules.map((m) => (
                  <option value={m.key} key={m.key}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Підпис / опис зображення
              <input name="title" maxLength={160} required />
            </label>
            <label>
              Медіафайл
              <input
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                required
              />
            </label>
            <label>
              Текстова версія або конспект відео (обов’язково для відео)
              <textarea name="transcript" rows={5} maxLength={12000} />
            </label>
            <p className="muted">
              Поки файл завантажується, залишайте цю сторінку відкритою. Відео відтворюється без
              автоматичного запуску.
            </p>
            <button className="button" disabled={action.pending}>
              {action.pending ? 'Завантажуємо файл…' : 'Завантажити матеріал'}
            </button>
          </fieldset>
        </form>
      )}
      {locked && (
        <p className="muted">Матеріали захищено, оскільки на курс уже зараховано студентів.</p>
      )}
      <Notice error={action.error} success={action.success} />
    </section>
  )
}
