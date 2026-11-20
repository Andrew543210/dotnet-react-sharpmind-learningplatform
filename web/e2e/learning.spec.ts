import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Content = {
  content: {
    modules: { key: string; questions: { id: string; correct: number }[] }[]
    finalQuestions: { id: string; correct: number }[]
  }
}
const curriculum = JSON.parse(
  readFileSync('../src/SharpMind.Api/Content/react-state-forms.json', 'utf8'),
) as Content
const password = process.env.Demo__Password!
async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Електронна пошта').fill(email)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Увійти', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Вийти', exact: true })).toBeVisible()
}
// Screenshots go to test-results by default so a test run never rewrites the
// documentation; set SCREENSHOT_DIR=../docs/screenshots to refresh the README images.
const screenshotDir = process.env.SCREENSHOT_DIR ?? 'test-results/screenshots'
async function capture(page: Page, name: string) {
  await page.screenshot({ path: resolve(screenshotDir, `${name}.png`), fullPage: true })
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([])
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

test('ten complete courses, filters, accessible catalog and responsive layouts', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.course-card')).toHaveCount(10)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await noOverflow(page)
    await accessible(page)
    await capture(page, `catalog-${width}`)
  }
  await page.getByRole('button', { name: 'DevOps', exact: true }).click()
  await expect(page.locator('.course-card')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Пошук курсу' }).fill('NoSuchCourse')
  await page.getByRole('button', { name: 'Знайти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'За цими умовами курсів немає' })).toBeVisible()
  await page.getByRole('button', { name: 'Очистити фільтри' }).click()
  await expect(page.locator('.course-card')).toHaveCount(10)
})

test('student request, mentor decision, learning, grading and verifiable certificate', async ({
  browser,
}) => {
  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const mentorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const student = await studentContext.newPage()
  const mentor = await mentorContext.newPage()
  await login(student, 'student@demo.sharpmind.test')
  await student.goto('/')
  await student.getByRole('link', { name: 'React • стан, форми та API', exact: true }).click()
  const courseId = new URL(student.url()).pathname.split('/').pop()!
  await student.getByRole('button', { name: 'Подати заявку', exact: true }).click()
  await expect(
    student.getByText('Заявка на розгляді. Ментор відкриє доступ після схвалення.'),
  ).toBeVisible()
  await login(mentor, 'mentor2@demo.sharpmind.test')
  await mentor.getByRole('button', { name: 'Заявки студентів' }).click()
  await mentor.getByRole('button', { name: 'Схвалити', exact: true }).click()
  await expect(mentor.getByRole('heading', { name: 'Нових заявок немає' })).toBeVisible()
  await student.reload()
  for (const module of curriculum.content.modules) {
    await student.goto(`/learn/${courseId}/${module.key}`)
    await expect(
      student.getByRole('heading', { name: 'Відео англійською', exact: true }),
    ).toBeVisible()
    await student.getByRole('button', { name: 'Позначити прочитаним' }).click()
    await expect(student.getByRole('button', { name: 'Прочитано', exact: true })).toBeDisabled()
    if (module.key === 'state') {
      await accessible(student)
      await capture(student, 'lesson-desktop')
      await student.setViewportSize({ width: 390, height: 844 })
      await noOverflow(student)
      await capture(student, 'lesson-mobile')
      await student.setViewportSize({ width: 1440, height: 1000 })
    }
    await student.goto(`/quiz/${courseId}/${module.key}`)
    await expect(student.locator('fieldset.question')).toHaveCount(10)
    if (module.key === 'state') await accessible(student)
    for (const q of module.questions)
      await student.locator(`input[name="${q.id}"][value="${q.correct}"]`).check()
    await student.getByRole('button', { name: 'Завершити тест', exact: true }).click()
    await expect(student.getByRole('heading', { name: 'Знання підтверджено' })).toBeVisible()
    await student.goto(`/learn/${courseId}/${module.key}`)
    await student.getByRole('button', { name: 'Практична робота', exact: true }).click()
    await student
      .getByLabel('Код, пояснення та перевірки')
      .fill(
        'Перевірка наскрізного навчального сценарію. Реалізація, пояснення рішення та перевірки граничних випадків наведені в цій тестовій відповіді; це не реальна робота студента.',
      )
    await student.getByRole('button', { name: 'Надіслати ментору' }).click()
    await expect(
      student.getByText('Робота в черзі перевірки. Результат з’явиться тут.'),
    ).toBeVisible()
    await mentor.goto('/studio?tab=submissions')
    const card = mentor.locator('.grade-card').filter({ hasText: 'Марія Шевченко' })
    await card.getByLabel('Коректність / 40').fill('35')
    await card.getByLabel('Обґрунтування / 25').fill('20')
    await card.getByLabel('Перевірки / 25').fill('20')
    await card.getByLabel('Зрозумілість / 10').fill('8')
    await card
      .getByLabel('Відгук: що вдалося та що покращити')
      .fill(
        'Наскрізна тестова перевірка: оцінювання та відгук збережені за погодженими критеріями.',
      )
    await card.getByRole('button', { name: 'Зберегти оцінку й відгук' }).click()
    await expect(mentor.getByRole('heading', { name: 'Черга перевірки порожня' })).toBeVisible()
  }
  await student.goto(`/quiz/${courseId}/final`)
  for (const q of curriculum.content.finalQuestions)
    await student.locator(`input[name="${q.id}"][value="${q.correct}"]`).check()
  await student.getByRole('button', { name: 'Завершити тест', exact: true }).click()
  await expect(student.getByRole('heading', { name: 'Знання підтверджено' })).toBeVisible()
  await student.getByRole('link', { name: 'До програми', exact: true }).click()
  await student.getByRole('button', { name: 'Отримати сертифікат' }).click()
  await expect(student.getByRole('heading', { name: 'Марія Шевченко', exact: true })).toBeVisible()
  const certificateUrl = student.url()
  await accessible(student)
  await capture(student, 'certificate')
  const anonymous = await browser.newPage()
  await anonymous.goto(certificateUrl)
  await expect(anonymous.getByText('Справжність підтверджено', { exact: false })).toBeVisible()
  await student.goto('/my-learning')
  await expect(student.locator('.progress-wrap')).toHaveText('100%')
  await studentContext.close()
  await mentorContext.close()
  await anonymous.close()
})

test('mentor can add photo and video materials; student cannot use studio', async ({ page }) => {
  await login(page, 'mentor@demo.sharpmind.test')
  await page.getByRole('link', { name: 'Новий курс' }).click()
  await page.getByLabel('Назва', { exact: true }).fill('Медіакурс для наскрізної перевірки')
  await page.getByLabel('Коротка адреса курсу').fill('e2e-media-course')
  await page
    .getByLabel('Опис', { exact: true })
    .fill('Тестова чернетка для перевірки завантаження фото та відео до навчальної програми.')
  await page.getByRole('button', { name: 'Зберегти курс', exact: true }).click()
  await expect(page.getByText('Публікація та доступ', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Додати модуль' }).click()
  await page.getByText('1. Новий модуль', { exact: true }).click()
  await page.getByLabel('Назва модуля', { exact: true }).fill('Медіаматеріали')
  await page.getByRole('button', { name: 'Зберегти курс', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Додати матеріал до збереженого модуля' }),
  ).toBeVisible()
  await page
    .getByLabel('Підпис / опис зображення')
    .fill('Навчальне зображення для перевірки завантаження')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('link', { name: '← До майстерні', exact: true }).click()
  await expect(page.getByLabel('Підпис / опис зображення')).toHaveValue(
    'Навчальне зображення для перевірки завантаження',
  )
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO0YAAAAASUVORK5CYII=',
    'base64',
  )
  await page
    .getByLabel('Медіафайл', { exact: true })
    .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png })
  await page.getByRole('button', { name: 'Завантажити матеріал', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'Навчальне зображення для перевірки завантаження' }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'Навчальне зображення для перевірки завантаження' })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1)
  // The real playable WebM fixture is generated by scripts/create-video-fixture.mjs.
  await page.getByLabel('Підпис / опис зображення').fill('Коротке навчальне відео')
  await page
    .getByLabel('Медіафайл', { exact: true })
    .setInputFiles(resolve('e2e/fixtures/lesson.webm'))
  await page
    .getByLabel('Текстова версія або конспект відео (обов’язково для відео)')
    .fill(
      'Коротке тестове відео демонструє кольоровий кадр. Воно використовується лише для перевірки реального завантаження й відтворення.',
    )
  await page.getByRole('button', { name: 'Завантажити матеріал', exact: true }).click()
  await expect(page.locator('video')).toHaveCount(1)
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(1)
  await page.locator('video').evaluate((video) => (video as HTMLVideoElement).play())
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await capture(page, 'media-mobile')
  await page.getByRole('button', { name: 'Вийти', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Створити акаунт', exact: true })).toBeVisible()
  await login(page, 'student@demo.sharpmind.test')
  await page.goto('/studio')
  await expect(page.getByRole('heading', { name: 'Ця сторінка для іншої ролі' })).toBeVisible()
})

test('student support request receives a private administrator reply', async ({ browser }) => {
  const student = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const admin = await browser.newPage()
  await login(student, 'student@demo.sharpmind.test')
  await student.getByRole('link', { name: 'Підтримка', exact: true }).click()
  await student.getByLabel('Тема', { exact: true }).fill('Питання про навчальний доступ')
  await student
    .getByLabel('Що трапилося?')
    .fill('Підкажіть, як отримати доступ до матеріалів після схвалення заявки ментором.')
  await student.getByRole('button', { name: 'Надіслати звернення' }).click()
  await expect(student.getByText('Очікує відповіді', { exact: true })).toBeVisible()
  await noOverflow(student)
  await login(admin, 'admin@demo.sharpmind.test')
  await admin.getByRole('link', { name: 'Підтримка', exact: true }).click()
  const ticket = admin.locator('.ticket').filter({ hasText: 'Питання про навчальний доступ' })
  const reply =
    'Відкрийте «Моє навчання» після схвалення заявки. У картці курсу з’явиться посилання на програму.'
  await ticket.getByLabel('Відповідь', { exact: true }).fill(reply)
  await ticket.getByRole('button', { name: 'Відповісти й закрити' }).click()
  await expect(ticket.getByText('Вирішено', { exact: true })).toBeVisible()
  await student.reload()
  await expect(student.getByText(reply, { exact: true })).toBeVisible()
  await student.close()
  await admin.close()
})
